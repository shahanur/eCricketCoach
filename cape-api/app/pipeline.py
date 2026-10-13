"""Analysis orchestrator (spec §2, §6.1, §11.6): one decode pass -> metrics -> coaching -> artifacts."""

from __future__ import annotations

import math
import logging
from collections import deque
from functools import partial
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from . import coaching, kinematics, render
from .config import Settings
from .gemini_contact import ContactSelection, GeminiContactError, select_contact_frame
from .bowling import bounce_index, delivery_metrics, line_zone
from .calibration import Calibrator
from .models.base import Box, Landmarks, PoseResult
from .schemas import (
    ARTIFACT_NAMES,
    PITCH_LENGTH_M,
    POPPING_CREASE_M,
    AnalysisRequest,
    AnalysisResponse,
    AnalyticsPayload,
    CapeError,
    Coaching,
    DownloadEndpoints,
    Handedness,
    Metadata,
    Point,
    PointOfContact,
    PostContact,
    PreContact,
    Release,
    Severity,
    Target,
    line_offset_m,
)
from .tracking.state_machine import Phase, Tracker

PRE_CONTACT_S = 0.15
POST_CONTACT_S = 0.2
POST_POINTS = 5
LOCK_TIMEOUT_FRAMES = 10
MOVE_FRACTION = 0.005  # of frame width per frame, to call a person "moving"
NOSE_HEIGHT_M = 1.68  # assumed nose height; release height is a body-ratio estimate (approximate)
DEFAULT_FPS = 30.0
CRICKET_BALL_MASS_KG = 0.156
log = logging.getLogger("cape")
YOLO_POSE_NAMES = (
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
)
LOWER_BODY_POINTS = frozenset(("left_knee", "right_knee", "left_ankle", "right_ankle"))

_ENDPOINT_FIELDS = {
    Target.batter: ("pre_contact_snapshot", "impact_snapshot", "post_contact_snapshot"),
    Target.bowler: ("release_snapshot", "pitching_point_snapshot", "pitch_map"),
}


# --- geometry helpers ---------------------------------------------------------


def _dist(p: Point, q: Point) -> float:
    return math.hypot(p[0] - q[0], p[1] - q[1])


def _foot(box: Box) -> Point:
    return ((box.x1 + box.x2) / 2, box.y2)


def _center(box: Box) -> Point:
    return box.center


def _nearest(persons: list[PoseResult], ref: Point, key=_foot) -> PoseResult | None:
    return min(persons, key=lambda p: _dist(key(p.box), ref), default=None)


def _xy(p) -> Point:
    return (float(p[0]), float(p[1]))


def bat_angle_deg(poly: np.ndarray, lm: Landmarks | None) -> float | None:
    """Bat principal axis vs vertical. With wrists: handle->toe angle from straight down (0–180°,
    > 90° means the toe is above the hands). Without wrists: 0–90°."""
    pts = np.asarray(poly, np.float64).reshape(-1, 2)
    if len(pts) < 3:
        return None
    mean = pts.mean(axis=0)
    evals, evecs = np.linalg.eigh(np.cov((pts - mean).T))
    if not np.all(np.isfinite(evals)) or evals.max() <= 0:
        return None
    axis = evecs[:, int(np.argmax(evals))]
    proj = (pts - mean) @ axis
    ends = (mean + axis * proj.min(), mean + axis * proj.max())
    wrists = [lm.points[k][:2] for k in ("left_wrist", "right_wrist") if lm and k in lm.points]
    if not wrists:
        return math.degrees(math.acos(min(1.0, abs(float(axis[1])))))
    hands = np.mean(np.asarray(wrists, np.float64), axis=0)
    handle, toe = sorted(ends, key=lambda e: float(np.linalg.norm(e - hands)))
    d = toe - handle
    return math.degrees(math.acos(max(-1.0, min(1.0, float(d[1] / np.linalg.norm(d))))))


def bat_angle_from_contact(lm: Landmarks | None, contact: Point | None) -> float | None:
    """Estimate the bat axis from the hand centre to the observed impact point."""
    wrists = [lm.points[k][:2] for k in ("left_wrist", "right_wrist") if lm and k in lm.points]
    if not wrists or contact is None:
        return None
    hands = np.mean(np.asarray(wrists, np.float64), axis=0)
    d = np.asarray(contact, np.float64) - hands
    length = float(np.linalg.norm(d))
    if length < 1:
        return None
    return math.degrees(math.acos(max(-1.0, min(1.0, float(d[1] / length)))))


def _metres_per_px(cal: Calibrator, p: Point) -> float | None:
    try:
        return _dist(cal.to_metres(p), cal.to_metres((p[0] + 10, p[1]))) / 10
    except ValueError:
        return None


def stride_m(lm: Landmarks, handedness, cal: Calibrator) -> float | None:
    front, back = kinematics.sides(handedness)
    fa, ba = lm.points.get(f"{front}_ankle"), lm.points.get(f"{back}_ankle")
    if fa is None or ba is None:
        return None
    try:
        return _dist(cal.to_metres(_xy(fa)), cal.to_metres(_xy(ba)))
    except ValueError:
        return None


def front_foot_metrics(
    lm: Landmarks,
    handedness,
    contact: Point,
    cal: Calibrator,
) -> dict[str, float]:
    """Front-foot/toe direction relative to the impact line and calibrated toe distance."""
    front, _ = kinematics.sides(handedness)
    ankle = lm.points.get(f"{front}_ankle")
    toe = lm.points.get(f"{front}_foot_index")
    if ankle is None or toe is None:
        return {}
    foot_vector = np.subtract(toe[:2], ankle[:2], dtype=np.float64)
    contact_vector = np.subtract(contact, ankle[:2], dtype=np.float64)
    if np.linalg.norm(foot_vector) < 1 or np.linalg.norm(contact_vector) < 1:
        return {}
    cross = float(foot_vector[0] * contact_vector[1] - foot_vector[1] * contact_vector[0])
    dot = float(np.dot(foot_vector, contact_vector))
    angle = math.degrees(math.atan2(cross, dot))
    out = {"front_foot_to_contact_angle_deg": angle}
    try:
        out["front_toe_contact_distance_cm"] = _dist(cal.to_metres(_xy(toe)), cal.to_metres(contact)) * 100
    except ValueError:
        pass
    return out


def batting_alignment_metrics(
    lm: Landmarks,
    handedness,
    contact: Point,
    cal: Calibrator,
) -> tuple[dict[str, float], tuple[Point, Point] | None]:
    """Checklist alignment metrics at impact; nose is the available chin-line proxy."""
    front, back = kinematics.sides(handedness)
    points = lm.points
    torso = kinematics.torso_length(lm)
    nose = points.get("nose")
    front_toe = points.get(f"{front}_foot_index")
    front_shoulder = points.get(f"{front}_shoulder")
    back_shoulder = points.get(f"{back}_shoulder")
    front_elbow = points.get(f"{front}_elbow")
    back_ankle = points.get(f"{back}_ankle")
    back_toe = points.get(f"{back}_foot_index")
    metrics: dict[str, float] = {}

    if torso and nose is not None and front_toe is not None:
        metrics["chin_front_toe_offset_pct"] = abs(nose[0] - front_toe[0]) / torso * 100
    if front_shoulder is not None and back_shoulder is not None:
        shoulder = np.subtract(front_shoulder[:2], back_shoulder[:2], dtype=np.float64)
        target = np.subtract(contact, front_shoulder[:2], dtype=np.float64)
        if np.linalg.norm(shoulder) >= 1 and np.linalg.norm(target) >= 1:
            cosine = float(np.dot(shoulder, target) / (np.linalg.norm(shoulder) * np.linalg.norm(target)))
            shoulder_angle = math.degrees(
                math.acos(max(-1.0, min(1.0, cosine)))
            )
            metrics["front_shoulder_target_angle_deg"] = min(shoulder_angle, 180 - shoulder_angle)
    if torso and front_shoulder is not None and front_elbow is not None:
        metrics["front_elbow_height_pct"] = (front_shoulder[1] - front_elbow[1]) / torso * 100

    crease_line = None
    if back_ankle is not None:
        try:
            ankle_m = cal.to_metres(_xy(back_ankle))
            crease_line = (
                cal.to_pixels((ankle_m[0] - 0.5, ankle_m[1])),
                cal.to_pixels((ankle_m[0] + 0.5, ankle_m[1])),
            )
            if back_toe is not None:
                toe_m = cal.to_metres(_xy(back_toe))
                dx, dy = toe_m[0] - ankle_m[0], toe_m[1] - ankle_m[1]
                if math.hypot(dx, dy) > 0.001:
                    metrics["back_foot_crease_angle_deg"] = math.degrees(math.atan2(abs(dy), abs(dx)))
        except ValueError:
            pass
    return metrics, crease_line


def bat_ahead_of_pad_cm(poly: np.ndarray, lm: Landmarks, handedness, cal: Calibrator) -> float | None:
    """Most-forward bat point minus front-knee x along the batter's facing direction, in cm."""
    front, back = kinematics.sides(handedness)
    p = lm.points
    knee, fa, ba = p.get(f"{front}_knee"), p.get(f"{front}_ankle"), p.get(f"{back}_ankle")
    if knee is None or fa is None or ba is None or fa[0] == ba[0]:
        return None
    forward = 1.0 if fa[0] > ba[0] else -1.0
    lead = float(np.max(forward * np.asarray(poly, np.float64).reshape(-1, 2)[:, 0]))
    scale = _metres_per_px(cal, _xy(fa))
    return None if scale is None else (lead - forward * knee[0]) * scale * 100


def release_height_m(lm: Landmarks) -> float | None:
    """Highest wrist above the ankles, scaled by an assumed nose height (approximate)."""
    p = lm.points
    ankles = [p[k][1] for k in ("left_ankle", "right_ankle") if k in p]
    wrists = [p[k][1] for k in ("left_wrist", "right_wrist") if k in p]
    if not ankles or not wrists or "nose" not in p:
        return None
    ground = max(ankles)
    body = ground - p["nose"][1]
    return None if body <= 0 else (ground - min(wrists)) / body * NOSE_HEIGHT_M


def _bowling_side(lm: Landmarks | None) -> Handedness:
    """Bowling arm = higher wrist at release; mapped to the 'back' side for pose_metrics."""
    p = lm.points if lm else {}
    if "left_wrist" in p and "right_wrist" in p and p["left_wrist"][1] < p["right_wrist"][1]:
        return Handedness.left
    return Handedness.right


def _speed(cal: Calibrator, pts: list[tuple[int, Point]], fps: float) -> float | None:
    if len(pts) < 2 or pts[-1][0] <= pts[0][0]:
        return None
    try:
        return round(cal.speed_kmh(pts[0][1], pts[-1][1], (pts[-1][0] - pts[0][0]) / fps), 1)
    except ValueError:
        return None


# --- overlays -----------------------------------------------------------------


def _fmt(metric: str, value: float) -> str:
    base = metric.split(".")[-1]
    label = base
    for suffix in ("_deg", "_pct", "_cm", "_m"):
        label = label.removesuffix(suffix)
    label = label.replace("_", " ").capitalize()
    if base in kinematics.ANGLE_METRICS or base.endswith("_deg"):
        text = f"{value:.0f} deg"
    elif base.endswith("_pct"):
        text = f"{value:.0f}%"
    elif base.endswith("_cm"):
        text = f"{value:.0f} cm"
    elif base.endswith("_m"):
        text = f"{value:.2f} m"
    else:
        text = f"{value:.1f}"
    return f"{label}: {text}"


def _statuses(result: Coaching) -> dict[str, str]:
    out: dict[str, str] = {}
    for f in result.faults:
        out.setdefault(f.metric, "warn" if f.severity is Severity.low else "fault")
    return out


def _checked(req: AnalysisRequest, milestone: str) -> list[str]:
    return list(dict.fromkeys(c["metric"] for c in coaching.applicable_checks(req) if c["milestone"] == milestone))


def _angle_layers(lm: Landmarks | None, handedness, metrics, checked, statuses) -> list:
    layers = []
    for metric in checked:
        pts = kinematics.angle_points(lm, handedness, metric) if lm else None
        if pts is None or metric not in metrics:
            continue
        a, b, c = (_xy(p) for p in pts)
        layers.append(partial(render.draw_angle, a=a, b=b, c=c, value=metrics[metric], status=statuses.get(metric, "ok")))
    return layers


def _panel(title: str, lines: list[str]):
    return partial(render.draw_metrics, lines=[title, *lines][:8])


def _body_layers(lm: Landmarks | None, handedness, statuses: dict[str, str], ball: Point | None) -> list:
    """Skeleton with head/elbow/knee key points, head-over-front-knee plumb line and head-to-ball sight line."""
    if lm is None:
        return []
    pts = lm.points
    layers: list = [partial(render.draw_skeleton, points={k: _xy(v) for k, v in pts.items()})]
    if "nose" in pts:
        knee = pts.get(f"{kinematics.sides(handedness)[0]}_knee")
        layers.append(partial(
            render.draw_alignment,
            head=_xy(pts["nose"]),
            knee=_xy(knee) if knee is not None else None,
            ball=ball,
            status=statuses.get("head_front_knee_offset_pct", "ok"),
        ))
    return layers


def _ball_layer(ball: Point | None) -> list:
    return [partial(render.draw_ball, point=ball)] if ball is not None else []


def _last_at(hist, frame_idx: int) -> Point | None:
    pts = [pt for f, pt in hist if f <= frame_idx]
    return pts[-1] if pts else None


# --- single decoding pass -----------------------------------------------------


class _Pass:
    def __init__(
        self,
        req: AnalysisRequest,
        cal: Calibrator,
        det: Any,
        fps: float,
        width: int,
        contact_selection: ContactSelection | None = None,
    ) -> None:
        self.req, self.cal, self.det, self.fps, self.width = req, cal, det, fps, max(width, 1)
        self.batter = req.target is Target.batter
        self.tracker = Tracker()
        self.buffer: deque[tuple[int, np.ndarray]] = deque(maxlen=int(fps * 0.5) + 16)
        self.frames: dict[str, tuple[int, np.ndarray]] = {}
        self.boxes: dict[str, Box | None] = {}
        self.locked: Box | None = None
        self.prev_persons: list[PoseResult] = []
        self.lock_tries = 0
        self.track: list[tuple[int, Point]] = []
        self.ball_track: list[tuple[int, Point]] = []
        self.post_target: int | None = None
        self.best_bat_contact: tuple[float, int, np.ndarray] | None = None
        self.contact_selection = contact_selection
        self.visual_contact_point: Point | None = None
        self.done = False
        ref = (0.0, 0.0) if self.batter else (0.0, PITCH_LENGTH_M - POPPING_CREASE_M)
        try:
            self.crease_px = cal.to_pixels(ref)
        except ValueError:
            self.crease_px = (self.width / 2, 0.0)

    def _frame_at(self, idx: int) -> tuple[int, np.ndarray]:
        best = self.buffer[0]
        for f, img in self.buffer:
            if f <= idx:
                best = (f, img)
        return best

    def _keep(self, key: str, idx: int, frame: np.ndarray) -> None:
        self.frames[key] = (idx, frame.copy())

    def _try_lock(self, frame: np.ndarray) -> None:
        persons = self.det.pose.detect(frame)
        if self.batter:
            p = _nearest(persons, self.crease_px)
            self.locked = p.box if p else None
            return
        self.lock_tries += 1
        if persons and self.prev_persons:
            moving = [
                p for p in persons
                if min(_dist(p.box.center, q.box.center) for q in self.prev_persons) > MOVE_FRACTION * self.width
            ]
            pool = moving or (persons if self.lock_tries >= LOCK_TIMEOUT_FRAMES else [])
            p = _nearest(pool, self.crease_px)
            self.locked = p.box if p else None
        self.prev_persons = persons

    def _person_box(self, frame: np.ndarray, ref: Point) -> Box | None:
        p = _nearest(self.det.pose.detect(frame), ref, key=_center)
        return p.box if p else self.locked

    def step(self, idx: int, frame: np.ndarray) -> None:
        self.buffer.append((idx, frame))
        hit = self.det.ball.detect(frame)
        ball = hit.center if hit is not None else None
        if self.locked is None:
            self._try_lock(frame)
        (self._batter_step if self.batter else self._bowler_step)(idx, frame, ball)

    def _batter_step(self, idx: int, frame: np.ndarray, ball: Point | None) -> None:
        if ball is not None:
            self.ball_track.append((idx, ball))
        if ball is not None and self.contact_selection is None:
            bat = self.det.bat.segment(frame)
            if bat is not None and len(bat) >= 3:
                distance = abs(float(cv2.pointPolygonTest(np.asarray(bat, dtype=np.float32), ball, True)))
                persons = self.det.pose.detect(frame)
                batter = _nearest(persons, self.crease_px)
                wrists = []
                if batter and len(batter.keypoints) > 10:
                    wrists = [p for p in (batter.keypoints[9], batter.keypoints[10]) if p[0] > 0 and p[1] > 0]
                wrist_distance = min(
                    abs(float(cv2.pointPolygonTest(np.asarray(bat, dtype=np.float32), wrist, True)))
                    for wrist in wrists
                ) if wrists else None
                # Reject bat-like background lines that are nowhere near the batter's hands.
                if wrist_distance is not None and wrist_distance <= max(120.0, self.width * 0.16):
                    score = distance + wrist_distance * 0.35
                    if self.best_bat_contact is None or score < self.best_bat_contact[0]:
                        self.best_bat_contact = (score, idx, frame.copy())
        self.tracker.update(idx, ball)
        if self.contact_selection is not None:
            contact_frame = self.contact_selection.frame_index
            pre_frame = max(0, contact_frame - round(self.fps * PRE_CONTACT_S))
            post_frame = contact_frame + max(POST_POINTS, round(self.fps * POST_CONTACT_S))
            ref = self.locked.center if self.locked else self.crease_px
            if idx == pre_frame:
                self._keep("pre_contact", idx, frame)
                self.boxes["pre_contact"] = self._person_box(frame, ref)
            if idx == contact_frame:
                self._keep("point_of_contact", idx, frame)
                self.boxes["point_of_contact"] = self._person_box(frame, ref)
                self.tracker.contact_frame = idx
                if self.contact_selection.contact_point_norm is not None:
                    height, width = frame.shape[:2]
                    x, y = self.contact_selection.contact_point_norm
                    self.visual_contact_point = (x * width, y * height)
            if idx >= post_frame and "post_contact" not in self.frames:
                self._keep("post_contact", idx, frame)
                self.boxes["post_contact"] = self._person_box(frame, ref)
            return
        c = self.tracker.contact_frame
        if c is not None and self.post_target is None:
            cf, cimg = self._frame_at(c)
            pf, pimg = self._frame_at(max(0, c - round(self.fps * PRE_CONTACT_S)))
            self._keep("point_of_contact", cf, cimg)
            self._keep("pre_contact", pf, pimg)
            ref = self.locked.center if self.locked else self.crease_px
            self.boxes["point_of_contact"] = self._person_box(cimg, ref)
            self.boxes["pre_contact"] = self._person_box(pimg, ref)
            self.post_target = c + max(POST_POINTS, round(self.fps * POST_CONTACT_S))
        if self.post_target is not None and idx >= self.post_target and "post_contact" not in self.frames:
            self._keep("post_contact", idx, frame)
            # Keep scanning so a bat-ball proximity minimum later in the clip can
            # replace an early velocity-inversion estimate.

    def _bowler_step(self, idx: int, frame: np.ndarray, ball: Point | None) -> None:
        if ball is None:
            return
        self.track.append((idx, ball))
        if len(self.track) == 1:
            self._keep("release", idx, frame)
            self.boxes["release"] = self._person_box(frame, ball)
        b = bounce_index(self.track, settled=True)
        if b is not None:
            self._keep("pitching_point", *self._frame_at(self.track[b][0]))
            self.done = True

    def finish(self) -> None:
        if self.batter and self.contact_selection is not None:
            self.tracker.contact_frame = self.contact_selection.frame_index
        elif self.batter and self.best_bat_contact is not None:
            _, frame_idx, frame = self.best_bat_contact
            self._keep("point_of_contact", frame_idx, frame)
            ref = self.locked.center if self.locked else self.crease_px
            self.boxes["point_of_contact"] = self._person_box(frame, ref)
            self.tracker.contact_frame = frame_idx
        if self.batter and self.post_target is not None and "post_contact" not in self.frames and self.buffer:
            self._keep("post_contact", *self.buffer[-1])
        if self.batter and self.contact_selection is not None and "post_contact" not in self.frames and self.buffer:
            self._keep("post_contact", *self.buffer[-1])
            ref = self.locked.center if self.locked else self.crease_px
            self.boxes["post_contact"] = self._person_box(self.buffer[-1][1], ref)

    def landmarks(self, key: str) -> Landmarks | None:
        box = self.boxes.get(key)
        if key not in self.frames or box is None:
            return None
        frame = self.frames[key][1]
        landmarks = self.det.landmarks.estimate_in_frame(frame, box)
        if landmarks is not None and LOWER_BODY_POINTS.issubset(landmarks.points):
            return landmarks
        foot_landmarks = landmarks
        foot_points = {"left_foot_index", "right_foot_index"}
        if landmarks is None or not foot_points.issubset(landmarks.points):
            foot_landmarks = self.det.landmarks.estimate_in_frame(frame, box, pad=0.3) or landmarks
        person = _nearest(self.det.pose.detect(frame), box.center, key=_center)
        if person is None or len(person.keypoints) < len(YOLO_POSE_NAMES):
            return landmarks
        yolo_points = {
            name: (float(point[0]), float(point[1]), 0.0)
            for name, point in zip(YOLO_POSE_NAMES, person.keypoints)
            if point[0] > 0 and point[1] > 0
        }
        if not yolo_points:
            return landmarks
        if foot_landmarks is not None:
            for name in ("left_heel", "right_heel", "left_foot_index", "right_foot_index"):
                if name in foot_landmarks.points:
                    yolo_points[name] = foot_landmarks.points[name]
        # Use one internally consistent 2D skeleton when MediaPipe loses the
        # lower body. MediaPipe heel/toe points supplement YOLO because COCO
        # Pose ends at the ankle and cannot express foot direction.
        return Landmarks(yolo_points)


# --- target-specific analysis -------------------------------------------------


def _analyze_batter(p: _Pass, req: AnalysisRequest, cal: Calibrator, fps: float):
    if p.tracker.contact_frame is None or "point_of_contact" not in p.frames or "pre_contact" not in p.frames:
        raise CapeError(422, "no_contact_detected", "No bat-ball contact was detected in the clip")
    h = req.handedness
    lm_c, lm_p, lm_post = (
        p.landmarks("point_of_contact"),
        p.landmarks("pre_contact"),
        p.landmarks("post_contact"),
    )
    cf, cimg = p.frames["point_of_contact"]
    metrics: dict[str, float] = kinematics.pose_metrics(lm_c, h) if lm_c else {}
    pre_angles = {k: round(v, 1) for k, v in kinematics.batter_angles(lm_p, h).items()} if lm_p else {}
    if lm_p:
        metrics.update({f"pre_contact.{k}": v for k, v in kinematics.pose_metrics(lm_p, h).items()})
        if lm_c and (travel := kinematics.head_travel_pct(lm_p, lm_c)) is not None:
            metrics["head_travel_pct"] = travel
    poly = p.det.bat.segment(cimg)
    bat_angle = (
        bat_angle_deg(poly, lm_c)
        if poly is not None
        else bat_angle_from_contact(lm_c, p.visual_contact_point)
    )
    extras = {
        "bat_angle_deg": bat_angle,
        "stride_m": stride_m(lm_c, h, cal) if lm_c else None,
        "bat_ahead_of_pad_cm": bat_ahead_of_pad_cm(poly, lm_c, h, cal) if lm_c and poly is not None else None,
    }
    metrics.update({k: v for k, v in extras.items() if v is not None})
    all_track = p.ball_track or [
        *p.tracker.history(Phase.PRE_CONTACT),
        *p.tracker.history(Phase.AT_CONTACT),
        *p.tracker.history(Phase.POST_CONTACT),
    ]
    pre_hist = [(f, pt) for f, pt in all_track if f <= cf]
    post_hist = [(f, pt) for f, pt in all_track if f >= cf]
    nearest = min(all_track, key=lambda item: abs(item[0] - cf), default=None)
    contact_point = p.visual_contact_point or (nearest[1] if nearest else None)
    if contact_point is None:
        raise CapeError(422, "no_contact_point_detected", "The impact frame was found but the contact point was not visible")
    contact_pt = (cf, contact_point)
    back_foot_crease_line = None
    if lm_c:
        metrics.update(front_foot_metrics(lm_c, h, contact_point, cal))
        alignment_metrics, back_foot_crease_line = batting_alignment_metrics(lm_c, h, contact_point, cal)
        metrics.update(alignment_metrics)
    result = coaching.evaluate(req, metrics, None)
    post_pts = post_hist[:POST_POINTS]
    exit_v = _speed(cal, post_pts, fps)
    launch = None
    if len(post_pts) >= 2:
        dx, dy = np.subtract(post_pts[-1][1], post_pts[0][1])
        launch = round(math.degrees(math.atan2(-dy, abs(dx))), 1)
    ball_v = _speed(cal, [*pre_hist[-POST_POINTS:], contact_pt], fps)
    inbound_momentum = round(CRICKET_BALL_MASS_KG * ball_v / 3.6, 2) if ball_v is not None else None
    inbound_energy = round(0.5 * CRICKET_BALL_MASS_KG * (ball_v / 3.6) ** 2, 1) if ball_v is not None else None
    exit_momentum = round(CRICKET_BALL_MASS_KG * exit_v / 3.6, 2) if exit_v is not None else None
    exit_energy = round(0.5 * CRICKET_BALL_MASS_KG * (exit_v / 3.6) ** 2, 1) if exit_v is not None else None
    ball_line = None
    try:
        contact_x, _ = cal.to_metres(contact_pt[1])
        ball_line = line_zone(line_offset_m(contact_x, h))
    except ValueError:
        pass

    statuses = _statuses(result)
    checked = _checked(req, "point_of_contact")
    pf = p.frames["pre_contact"][0]
    postf = p.frames["post_contact"][0]
    post_lines = []
    if exit_v is not None:
        post_lines.append(f"Exit speed: {exit_v:.0f} km/h")
    if launch is not None:
        post_lines.append(f"Launch angle: {launch:.0f} deg")
    if exit_momentum is not None:
        post_lines.append(f"Exit momentum: {exit_momentum:.2f} kg m/s")
    post_angles = {k: round(v, 1) for k, v in kinematics.batter_angles(lm_post, h).items()} if lm_post else {}
    pre_ball = _last_at(pre_hist, pf)
    post_ball = _last_at(post_hist, postf)
    landmark_points = {k: _xy(v) for k, v in lm_c.points.items()} if lm_c else {}
    incoming_start = pre_hist[max(0, len(pre_hist) - POST_POINTS)][1] if pre_hist else None
    outgoing_end = post_pts[-1][1] if post_pts else None
    overlays = {
        "pre_contact": [
            partial(render.draw_trail, pts=[pt for f, pt in pre_hist if f <= pf]),
            *_body_layers(lm_p, h, {}, pre_ball),
            *_angle_layers(lm_p, h, metrics, [m for m in _checked(req, "pre_contact") if m in pre_angles], {}),
            *_ball_layer(pre_ball),
            _panel("Pre-contact", [_fmt(k, v) for k, v in pre_angles.items()]),
        ],
        "point_of_contact": [
            partial(render.draw_trail, pts=[pt for _, pt in pre_hist] + [contact_pt[1]]),
            *_body_layers(lm_c, h, statuses, contact_pt[1]),
            *_angle_layers(lm_c, h, metrics, checked, statuses),
            partial(
                render.draw_batting_guides,
                points=landmark_points,
                handedness=h,
                contact=contact_pt[1],
                incoming_start=incoming_start,
                outgoing_end=outgoing_end,
                back_foot_crease_line=back_foot_crease_line,
            ),
            partial(render.draw_contact, point=contact_pt[1]),
        ],
        "post_contact": [
            partial(render.draw_trail, pts=[contact_pt[1]] + [pt for f, pt in post_hist if f <= postf]),
            *_body_layers(lm_post, h, {}, post_ball),
            *_angle_layers(lm_post, h, post_angles, list(post_angles), {}),
            *_ball_layer(post_ball),
            _panel("Post-contact", post_lines),
        ],
    }
    payload = AnalyticsPayload(
        pre_contact=PreContact(milestone_frame=pf, batter_joint_angles=pre_angles),
        point_of_contact=PointOfContact(
            milestone_frame=cf,
            selection_source="gemini" if p.contact_selection is not None else "detector",
            selection_confidence=p.contact_selection.confidence if p.contact_selection is not None else None,
            ball_velocity_kmh=ball_v,
            estimated_ball_momentum_kg_m_s=inbound_momentum,
            estimated_ball_kinetic_energy_j=inbound_energy,
            bat_angle_degrees=round(bat_angle, 1) if bat_angle is not None else None,
            head_front_knee_offset_pct=round(metrics["head_front_knee_offset_pct"], 1)
            if "head_front_knee_offset_pct" in metrics else None,
            stride_m=round(metrics["stride_m"], 2) if "stride_m" in metrics else None,
            front_foot_to_contact_angle_degrees=round(metrics["front_foot_to_contact_angle_deg"], 1)
            if "front_foot_to_contact_angle_deg" in metrics else None,
            front_toe_contact_distance_cm=round(metrics["front_toe_contact_distance_cm"], 1)
            if "front_toe_contact_distance_cm" in metrics else None,
            chin_front_toe_offset_pct=round(metrics["chin_front_toe_offset_pct"], 1)
            if "chin_front_toe_offset_pct" in metrics else None,
            front_shoulder_target_angle_degrees=round(metrics["front_shoulder_target_angle_deg"], 1)
            if "front_shoulder_target_angle_deg" in metrics else None,
            back_foot_crease_angle_degrees=round(metrics["back_foot_crease_angle_deg"], 1)
            if "back_foot_crease_angle_deg" in metrics else None,
            front_elbow_height_pct=round(metrics["front_elbow_height_pct"], 1)
            if "front_elbow_height_pct" in metrics else None,
            ball_line=ball_line,
            batter_joint_angles={k: round(v, 1) for k, v in metrics.items() if k in kinematics.ANGLE_METRICS},
            batter_3d_landmarks=dict(lm_c.points) if lm_c else {},
        ),
        post_contact=PostContact(
            milestone_frame=postf,
            exit_velocity_kmh=exit_v,
            estimated_ball_momentum_kg_m_s=exit_momentum,
            estimated_ball_kinetic_energy_j=exit_energy,
            launch_angle_degrees=launch,
            batter_joint_angles=post_angles,
        ),
    )
    return payload, None, result, overlays


def _analyze_bowler(p: _Pass, req: AnalysisRequest, cal: Calibrator, fps: float):
    delivery = delivery_metrics(p.track, cal, fps, req)
    if delivery is None or "pitching_point" not in p.frames:
        raise CapeError(422, "no_pitching_point_detected", "The ball's pitching point was not detected in the clip")
    lm = p.landmarks("release")
    side = _bowling_side(lm)
    metrics: dict[str, float] = kinematics.pose_metrics(lm, side) if lm else {}
    height = release_height_m(lm) if lm else None
    if height is not None:
        metrics["release_height_m"] = height
    result = coaching.evaluate(req, metrics, delivery)

    checked = _checked(req, "release")
    rf = p.frames["release"][0]
    pitch_f = p.frames["pitching_point"][0]
    speed = (
        f"Speed: {delivery.speed_kmh:.0f} km/h (+/-{delivery.speed_tolerance_kmh:.0f})"
        if delivery.speed_kmh is not None
        else None
    )
    release_lines = ([speed] if speed else []) + [_fmt(m, metrics[m]) for m in checked if m in metrics]
    pitch_pt = next((pt for f, pt in p.track if f == pitch_f), None)
    release_ball = p.track[0][1] if p.track else None
    release_statuses = _statuses(result)
    overlays = {
        "release": [
            *_body_layers(lm, side, release_statuses, release_ball),
            *_angle_layers(lm, side, metrics, checked, release_statuses),
            *_ball_layer(release_ball),
            _panel(f"{req.bowler_type.value.title()} bowling | score {result.score}/100", release_lines),
        ],
        "pitching_point": [
            partial(render.draw_trail, pts=[pt for f, pt in p.track if f <= pitch_f]),
            *([partial(render.draw_contact, point=pitch_pt)] if pitch_pt else []),
            *_ball_layer(pitch_pt),
            _panel(
                "Pitching point",
                [
                    f"Length: {delivery.length_m:.1f} m ({delivery.length_zone.value.replace('_', ' ')})",
                    f"Line: {delivery.line_zone.value.replace('_', ' ')}",
                    *([speed] if speed else []),
                ],
            ),
        ],
    }
    payload = AnalyticsPayload(
        release=Release(
            milestone_frame=rf,
            bowler_joint_angles={k: round(v, 1) for k, v in metrics.items() if k in kinematics.ANGLE_METRICS},
            release_height_m=round(height, 2) if height is not None else None,
        )
    )
    return payload, delivery, result, overlays


# --- entry point --------------------------------------------------------------


def analyze(
    video_path: Path,
    req: AnalysisRequest,
    session_dir: Path,
    detectors: Any = None,
    settings: Settings | None = None,
) -> AnalysisResponse:
    if detectors is None:
        raise CapeError(503, "models_unavailable", "Analysis models are not loaded")
    try:
        cal = Calibrator(req.calibration_points, req.pitch_points)
    except ValueError as exc:
        raise CapeError(422, "calibration_invalid", f"Calibration points are invalid: {exc}") from None

    contact_selection = None
    if req.target is Target.batter and settings and settings.gemini_contact:
        if settings.gemini_api_key:
            try:
                contact_selection = select_contact_frame(
                    video_path,
                    settings.gemini_api_key.get_secret_value(),
                    settings.gemini_model,
                    settings.gemini_timeout_seconds,
                    detectors.pose,
                    settings.gemini_contact_lead_frames,
                )
            except GeminiContactError as exc:
                log.warning("Gemini contact selection failed; using detector fallback: %s", exc)
        else:
            log.warning("Gemini contact selection enabled but CAPE_GEMINI_API_KEY is unset; using detector fallback")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise CapeError(422, "unreadable_video", "Video could not be decoded")
    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
        fps = fps if math.isfinite(fps) and fps > 0 else DEFAULT_FPS
        width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        scan = _Pass(req, cal, detectors, fps, width, contact_selection)
        idx = 0
        while not scan.done:
            ok, frame = cap.read()
            if not ok:
                break
            if not width:
                height, width = frame.shape[:2]
            scan.step(idx, frame)
            idx += 1
        scan.finish()
    finally:
        cap.release()
    if idx == 0:
        raise CapeError(422, "unreadable_video", "Video contains no decodable frames")

    analyze_target = _analyze_batter if scan.batter else _analyze_bowler
    payload, delivery, result, overlays = analyze_target(scan, req, cal, fps)

    frames = {k: img for k, (_, img) in scan.frames.items()}
    if delivery is not None:
        frames["pitch_map"] = render.draw_pitch_map(delivery, bowler_type=req.bowler_type, handedness=req.handedness)
    written = render.export_artifacts(session_dir, req.target, frames, overlays)

    session_id = Path(session_dir).name
    missing = {
        field: None
        for field, name in zip(_ENDPOINT_FIELDS[req.target], ARTIFACT_NAMES[req.target])
        if name not in written
    }
    return AnalysisResponse(
        session_id=session_id,
        metadata=Metadata(
            resolution=f"{width}x{height}",
            framerate_fps=round(fps, 3),
            selected_target=req.target,
            target=req.target,
            handedness=req.handedness,
            shot_type=req.shot_type,
            bowler_type=req.bowler_type,
        ),
        analytics_payload=payload,
        delivery=delivery,
        coaching=result,
        download_endpoints=DownloadEndpoints.for_session(session_id, req.target).model_copy(update=missing),
    )
