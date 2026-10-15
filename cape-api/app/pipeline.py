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
from .ingest import read_frames
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
BAT_FOREARM_RATIO = 3.0  # bat length / forearm length, for the pose-only bat estimate
# Manual mode with no pre/post frames selected: scan this long before/after the contact candidates.
AUTO_WINDOW_S = 1.0
AUTO_WINDOW_MAX_FRAMES = 30
# Hands-midpoint -> bat-toe length of a standard (SH) bat; sets the pixel scale for bat speed.
BAT_HANDS_TO_TIP_M = 0.8
SWING_SPEED_WINDOW_S = 0.2
MAX_PLAUSIBLE_BAT_SPEED_KMH = 250.0
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


def _statuses(result: Coaching, milestone: str | None = None) -> dict[str, str]:
    out: dict[str, str] = {}
    for f in result.faults:
        if milestone is None or f.milestone == milestone:
            out.setdefault(f.metric, "warn" if f.severity is Severity.low else "fault")
    return out


def _fault_lines(result: Coaching, milestone: str) -> list[str]:
    return [f"! {f.code.replace('_', ' ').capitalize()}" for f in result.faults if f.milestone == milestone][:3]


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


def swing_arc_deg(samples: list[tuple[Point | None, Point | None]]) -> float | None:
    """Total image-plane rotation of the bat (hands -> tip) across samples, ignoring tracking
    glitches; None if < 2 usable sightings or the result exceeds a full turn (implausible)."""
    bats = render.unwrapped_bat_angles(samples)
    if len(bats) < 2:
        return None
    total = abs(math.degrees(bats[-1][2] - bats[0][2]))
    return round(total, 1) if total <= 360 else None


def auto_window(start: int, end: int, keep_end: bool) -> list[int]:
    """Frames start..end (inclusive), thinned to AUTO_WINDOW_MAX_FRAMES; `keep_end` anchors the stride at `end`."""
    frames = list(range(max(0, start), end + 1))
    step = max(1, math.ceil(len(frames) / AUTO_WINDOW_MAX_FRAMES))
    return sorted(frames[::-1][::step]) if keep_end else frames[::step]


def bat_swing_speed_kmh(
    samples: list[tuple[int, Point | None, Point | None]], contact_frame: int, fps: float
) -> float | None:
    """Mean bat-tip speed over the last SWING_SPEED_WINDOW_S before contact, in km/h.

    `samples` are (frame, hands, tip) for the swing and follow-through. The pixel scale comes from
    the longest hands->tip length seen (least foreshortened) taken as BAT_HANDS_TO_TIP_M.
    """
    seen = [(f, h, t) for f, h, t in samples if h is not None and t is not None and _dist(h, t) > 1]
    if not seen or fps <= 0:
        return None
    m_per_px = BAT_HANDS_TO_TIP_M / max(_dist(h, t) for _, h, t in seen)
    swing = sorted((f, t) for f, _, t in seen if f <= contact_frame)
    for window_s in (SWING_SPEED_WINDOW_S, SWING_SPEED_WINDOW_S * 2):
        recent = [(f, t) for f, t in swing if contact_frame - f <= round(window_s * fps)]
        if len(recent) >= 2 and recent[-1][0] > recent[0][0]:
            path_px = sum(_dist(a, b) for (_, a), (_, b) in zip(recent, recent[1:]))
            speed = path_px * m_per_px / ((recent[-1][0] - recent[0][0]) / fps) * 3.6
            return round(speed, 1) if speed <= MAX_PLAUSIBLE_BAT_SPEED_KMH else None
    return None


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
        self.manual = req.manual_frames if self.batter else None
        # frame idx -> (hands, bat tip) for manually selected frames (swing / follow-through strobe).
        self.swing_samples: dict[int, tuple[Point | None, Point | None]] = {}
        # Frames whose bat tip was estimated from the forearms because the bat wasn't segmented.
        self.estimated_swing_frames: set[int] = set()
        # (tier, score, idx, frame, box, ball): lower is better; see _manual_step.
        self.best_manual_contact: tuple[int, float, int, np.ndarray, Box | None, Point | None] | None = None
        # Frames scanned for the swing / follow-through; scanned automatically when the user picked none.
        self.pre_frames: list[int] = []
        self.post_frames: list[int] = []
        self.pre_auto = self.post_auto = False
        # milestone -> (height score, frame idx) of the best automatic snapshot (highest bat tip).
        self.auto_snapshot: dict[str, tuple[float, int]] = {}
        if self.manual is not None:
            contact, window = self.manual.point_of_contact, round(fps * AUTO_WINDOW_S)
            self.pre_auto, self.post_auto = not self.manual.pre_contact, not self.manual.post_contact
            self.pre_frames = (
                auto_window(contact[0] - window, contact[0] - 1, keep_end=True)
                if self.pre_auto else list(self.manual.pre_contact)
            )
            self.post_frames = (
                auto_window(contact[-1] + 1, contact[-1] + window, keep_end=False)
                if self.post_auto else list(self.manual.post_contact)
            )
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
        if self.manual is not None:
            self.tracker.update(idx, ball)
            self._manual_step(idx, frame, ball)
            return
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

    def _hands_and_bat(self, frame: np.ndarray, ref: Point):
        """(person box, hands midpoint, bat tip, bat polygon, tip estimated from forearms) for the batter nearest `ref`."""
        person = _nearest(self.det.pose.detect(frame), ref, key=_center)
        hands = None
        forearms: list[tuple[Point, Point]] = []
        if person is not None and len(person.keypoints) > 10:
            kp = person.keypoints
            wrists = [p for p in (kp[9], kp[10]) if p[0] > 0 and p[1] > 0]
            if wrists:
                hands = (float(np.mean([w[0] for w in wrists])), float(np.mean([w[1] for w in wrists])))
            forearms = [(kp[e], kp[w]) for e, w in ((7, 9), (8, 10)) if min(*kp[e], *kp[w]) > 0 and _dist(kp[e], kp[w]) > 1]
        bat = self.det.bat.segment(frame)
        poly = np.asarray(bat, dtype=np.float32) if bat is not None and len(bat) >= 3 else None
        tip = None
        if poly is not None and hands is not None:
            # Reject bat-like background lines that are nowhere near the batter's hands.
            if abs(float(cv2.pointPolygonTest(poly, hands, True))) <= max(120.0, self.width * 0.16):
                # Tip = centroid of the far end, so corner vertices of a thick mask don't make it jitter.
                d = np.linalg.norm(poly - np.asarray(hands, dtype=np.float32), axis=1)
                far = poly[d >= d.max() * 0.9].mean(axis=0)
                tip = (float(far[0]), float(far[1]))
            else:
                poly = None
        estimated = False
        if tip is None and hands is not None and forearms:
            # Bat not segmented: extend the forearms (elbow -> wrist) past the hands. A bat is ~3 forearms long.
            ux = np.mean([(w[0] - e[0]) / _dist(e, w) for e, w in forearms])
            uy = np.mean([(w[1] - e[1]) / _dist(e, w) for e, w in forearms])
            norm = math.hypot(ux, uy)
            if norm > 1e-3:
                length = BAT_FOREARM_RATIO * float(np.mean([_dist(e, w) for e, w in forearms]))
                tip = (hands[0] + ux / norm * length, hands[1] + uy / norm * length)
                estimated = True
        return (person.box if person else self.locked), hands, tip, poly, estimated

    def _manual_step(self, idx: int, frame: np.ndarray, ball: Point | None) -> None:
        m = self.manual
        in_pre, in_contact, in_post = idx in self.pre_frames, idx in m.point_of_contact, idx in self.post_frames
        if not (in_pre or in_contact or in_post):
            return
        ref = self.locked.center if self.locked else self.crease_px
        box, hands, tip, poly, estimated = self._hands_and_bat(frame, ref)
        self.swing_samples[idx] = (hands, tip)
        if estimated:
            self.estimated_swing_frames.add(idx)
        for key, inside, auto, pick in (
            ("pre_contact", in_pre, self.pre_auto, self.pre_frames[:1]),
            ("post_contact", in_post, self.post_auto, self.post_frames[-1:]),
        ):
            if not inside:
                continue
            if auto:
                # Top of the backswing / end of the follow-through: the frame with the highest bat tip.
                top = tip or hands
                if top is None:
                    continue
                if key not in self.auto_snapshot or top[1] < self.auto_snapshot[key][0]:
                    self.auto_snapshot[key] = (top[1], idx)
                    self._keep(key, idx, frame)
                    self.boxes[key] = box
            elif [idx] == pick:
                self._keep(key, idx, frame)
                self.boxes[key] = box
        if not in_contact:
            return
        # Pick the best of the user's contact candidates: ball touching the bat near the hands
        # beats ball near the hands, which beats no evidence (then the middle candidate wins).
        if ball is not None and poly is not None and hands is not None:
            tier, score = 0, abs(float(cv2.pointPolygonTest(poly, ball, True))) + 0.35 * _dist(ball, hands)
        elif ball is not None and hands is not None:
            tier, score = 1, _dist(ball, hands)
        else:
            middle = m.point_of_contact[(len(m.point_of_contact) - 1) // 2]
            tier, score = 2, float(abs(idx - middle))
        if self.best_manual_contact is None or (tier, score) < self.best_manual_contact[:2]:
            self.best_manual_contact = (tier, score, idx, frame.copy(), box, ball)

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
        if self.manual is not None:
            if self.best_manual_contact is not None:
                _, _, frame_idx, frame, box, ball = self.best_manual_contact
                self._keep("point_of_contact", frame_idx, frame)
                self.boxes["point_of_contact"] = box
                self.tracker.contact_frame = frame_idx
                hands, tip = self.swing_samples.get(frame_idx, (None, None))
                if ball is not None:
                    self.visual_contact_point = ball
                elif hands is not None and tip is not None:
                    # Ball not visible: assume contact near the bat's sweet spot.
                    self.visual_contact_point = (hands[0] + (tip[0] - hands[0]) * 0.7, hands[1] + (tip[1] - hands[1]) * 0.7)
                elif hands is not None:
                    self.visual_contact_point = hands
                # No usable swing / follow-through frame (clip edge or no batter found): fall back to contact.
                for key in ("pre_contact", "post_contact"):
                    if key not in self.frames:
                        self._keep(key, frame_idx, frame)
                        self.boxes[key] = box
            return
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
    if lm_post:
        metrics.update({f"post_contact.{k}": v for k, v in kinematics.pose_metrics(lm_post, h).items()})
        if lm_c and (travel := kinematics.head_travel_pct(lm_c, lm_post)) is not None:
            metrics["post_contact.head_travel_pct"] = travel
    pf = p.frames["pre_contact"][0]
    postf = p.frames["post_contact"][0]
    swing_frames: list[int] = []
    follow_frames: list[int] = []
    swing_arc = follow_arc = swing_speed = None
    swing_note = follow_note = ""
    swing: list[tuple[Point | None, Point | None]] = []
    follow: list[tuple[Point | None, Point | None]] = []
    if req.manual_frames is not None:
        # Auto-scanned windows trace the downswing from the top of the backswing, and the
        # follow-through up to its highest finish; user-picked frames are all traced.
        swing_frames = [*(f for f in p.pre_frames if not p.pre_auto or f >= pf), cf]
        follow_frames = [cf, *(f for f in p.post_frames if not p.post_auto or f <= postf)]
        swing = [p.swing_samples.get(f, (None, None)) for f in swing_frames]
        follow = [p.swing_samples.get(f, (None, None)) for f in follow_frames]
        swing_arc, follow_arc = swing_arc_deg(swing), swing_arc_deg(follow)
        swing_speed = bat_swing_speed_kmh(
            [(f, *p.swing_samples.get(f, (None, None))) for f in dict.fromkeys([*swing_frames, *follow_frames])],
            cf,
            fps,
        )
        estimated = p.estimated_swing_frames
        swing_note = " (est.)" if estimated.intersection(swing_frames) else ""
        follow_note = " (est.)" if estimated.intersection(follow_frames) else ""
        if swing_arc is not None:
            metrics["pre_contact.bat_swing_arc_deg"] = swing_arc
        if follow_arc is not None:
            metrics["post_contact.follow_through_arc_deg"] = follow_arc
        if swing_speed is not None:
            metrics["pre_contact.bat_swing_speed_kmh"] = swing_speed
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

    statuses = _statuses(result, "point_of_contact")
    pre_statuses, post_statuses = _statuses(result, "pre_contact"), _statuses(result, "post_contact")
    checked = _checked(req, "point_of_contact")
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
    swing_layers: list = []
    follow_layers: list = []
    pre_lines = [_fmt(k, v) for k, v in pre_angles.items()]
    if req.manual_frames is not None:
        swing_layers = [
            partial(render.draw_swing_path, samples=swing, color=render.SWING_COLOR, label=f"Bat swing{swing_note}")
        ]
        follow_layers = [
            partial(
                render.draw_swing_path,
                samples=follow,
                color=render.FOLLOW_THROUGH_COLOR,
                label=f"Follow-through{follow_note}",
            )
        ]
        if swing_speed is not None:
            pre_lines.insert(0, f"Bat speed: {swing_speed:.0f} km/h{swing_note}")
        if swing_arc is not None:
            pre_lines.insert(0, f"Bat swing arc: {swing_arc:.0f} deg{swing_note}")
        if follow_arc is not None:
            post_lines.insert(0, f"Follow-through arc: {follow_arc:.0f} deg{follow_note}")
        if swing_note or follow_note:
            (post_lines if follow_note else pre_lines).append("est. = bat line inferred from forearms")
    # Faults found before / after contact lead their panels.
    pre_lines[:0] = _fault_lines(result, "pre_contact")
    post_lines[:0] = _fault_lines(result, "post_contact")
    landmark_points = {k: _xy(v) for k, v in lm_c.points.items()} if lm_c else {}
    incoming_start = pre_hist[max(0, len(pre_hist) - POST_POINTS)][1] if pre_hist else None
    outgoing_end = post_pts[-1][1] if post_pts else None
    overlays = {
        "pre_contact": [
            partial(render.draw_trail, pts=[pt for f, pt in pre_hist if f <= pf]),
            *_body_layers(lm_p, h, pre_statuses, pre_ball),
            *_angle_layers(lm_p, h, pre_angles, [m for m in _checked(req, "pre_contact") if m in pre_angles], pre_statuses),
            *swing_layers,
            *_ball_layer(pre_ball),
            _panel("Pre-contact", pre_lines),
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
            *_body_layers(lm_post, h, post_statuses, post_ball),
            *_angle_layers(lm_post, h, post_angles, list(post_angles), post_statuses),
            *follow_layers,
            *_ball_layer(post_ball),
            _panel("Post-contact", post_lines),
        ],
    }
    payload = AnalyticsPayload(
        pre_contact=PreContact(
            milestone_frame=pf,
            batter_joint_angles=pre_angles,
            swing_frames=swing_frames,
            bat_swing_arc_degrees=swing_arc,
            bat_swing_speed_kmh=swing_speed,
            swing_frames_auto=p.pre_auto,
            bat_swing_estimated=bool(swing_note),
        ),
        point_of_contact=PointOfContact(
            milestone_frame=cf,
            selection_source=(
                "manual" if req.manual_frames is not None
                else "gemini" if p.contact_selection is not None
                else "detector"
            ),
            candidate_frames=list(req.manual_frames.point_of_contact) if req.manual_frames is not None else [],
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
            follow_through_frames=follow_frames,
            follow_through_arc_degrees=follow_arc,
            follow_through_estimated=bool(follow_note),
            follow_through_frames_auto=p.post_auto,
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
    if req.manual_frames is None and req.target is Target.batter and settings and settings.gemini_contact:
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
        for frame in read_frames(cap):
            if scan.done:
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
    if req.manual_frames is not None and req.manual_frames.last_frame >= idx:
        raise CapeError(
            422,
            "manual_frames_out_of_range",
            f"Selected frames must be within the video's {idx} frames",
        )

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
