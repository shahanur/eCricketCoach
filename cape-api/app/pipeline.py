"""Analysis orchestrator (spec §2, §6.1, §11.6): one decode pass -> metrics -> coaching -> artifacts."""

from __future__ import annotations

import math
from collections import deque
from functools import partial
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from . import coaching, kinematics, render
from .bowling import bounce_index, delivery_metrics
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
)
from .tracking.state_machine import Phase, Tracker

PRE_CONTACT_S = 0.15
POST_CONTACT_S = 0.2
POST_POINTS = 5
LOCK_TIMEOUT_FRAMES = 10
MOVE_FRACTION = 0.005  # of frame width per frame, to call a person "moving"
NOSE_HEIGHT_M = 1.68  # assumed nose height; release height is a body-ratio estimate (approximate)
DEFAULT_FPS = 30.0

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
    def __init__(self, req: AnalysisRequest, cal: Calibrator, det: Any, fps: float, width: int) -> None:
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
        self.post_target: int | None = None
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
        self.tracker.update(idx, ball)
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
        if self.post_target is not None and idx >= self.post_target:
            self._keep("post_contact", idx, frame)
            self.done = True

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
        if self.batter and self.post_target is not None and "post_contact" not in self.frames and self.buffer:
            self._keep("post_contact", *self.buffer[-1])

    def landmarks(self, key: str) -> Landmarks | None:
        box = self.boxes.get(key)
        if key not in self.frames or box is None:
            return None
        return self.det.landmarks.estimate_in_frame(self.frames[key][1], box)


# --- target-specific analysis -------------------------------------------------


def _analyze_batter(p: _Pass, req: AnalysisRequest, cal: Calibrator, fps: float):
    if p.tracker.contact_frame is None:
        raise CapeError(422, "no_contact_detected", "No bat-ball contact was detected in the clip")
    h = req.handedness
    lm_c, lm_p = p.landmarks("point_of_contact"), p.landmarks("pre_contact")
    cf, cimg = p.frames["point_of_contact"]
    metrics: dict[str, float] = kinematics.pose_metrics(lm_c, h) if lm_c else {}
    pre_angles = {k: round(v, 1) for k, v in kinematics.batter_angles(lm_p, h).items()} if lm_p else {}
    if lm_p:
        metrics.update({f"pre_contact.{k}": v for k, v in kinematics.pose_metrics(lm_p, h).items()})
        if lm_c and (travel := kinematics.head_travel_pct(lm_p, lm_c)) is not None:
            metrics["head_travel_pct"] = travel
    poly = p.det.bat.segment(cimg)
    bat_angle = bat_angle_deg(poly, lm_c) if poly is not None else None
    extras = {
        "bat_angle_deg": bat_angle,
        "stride_m": stride_m(lm_c, h, cal) if lm_c else None,
        "bat_ahead_of_pad_cm": bat_ahead_of_pad_cm(poly, lm_c, h, cal) if lm_c and poly is not None else None,
    }
    metrics.update({k: v for k, v in extras.items() if v is not None})
    result = coaching.evaluate(req, metrics, None)

    pre_hist = p.tracker.history(Phase.PRE_CONTACT)
    contact_pt = p.tracker.history(Phase.AT_CONTACT)[0]
    post_hist = p.tracker.history(Phase.POST_CONTACT)
    post_pts = post_hist[:POST_POINTS]
    exit_v = _speed(cal, post_pts, fps)
    launch = None
    if len(post_pts) >= 2:
        dx, dy = np.subtract(post_pts[-1][1], post_pts[0][1])
        launch = round(math.degrees(math.atan2(-dy, abs(dx))), 1)
    ball_v = _speed(cal, [*pre_hist[-POST_POINTS:], contact_pt], fps)

    statuses = _statuses(result)
    checked = _checked(req, "point_of_contact")
    contact_lines = [_fmt(m, metrics[m]) for m in checked if m in metrics]
    if ball_v is not None:
        contact_lines.append(f"Ball speed: {ball_v:.0f} km/h")
    pf = p.frames["pre_contact"][0]
    postf = p.frames["post_contact"][0]
    title = f"{req.shot_type.value.replace('_', ' ').title()} | score {result.score}/100"
    post_lines = []
    if exit_v is not None:
        post_lines.append(f"Exit speed: {exit_v:.0f} km/h")
    if launch is not None:
        post_lines.append(f"Launch angle: {launch:.0f} deg")
    pre_ball = _last_at(pre_hist, pf)
    post_ball = _last_at(post_hist, postf)
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
            partial(render.draw_contact, point=contact_pt[1]),
            _panel(title, contact_lines),
        ],
        "post_contact": [
            partial(render.draw_trail, pts=[contact_pt[1]] + [pt for f, pt in post_hist if f <= postf]),
            *_ball_layer(post_ball),
            _panel("Post-contact", post_lines),
        ],
    }
    payload = AnalyticsPayload(
        pre_contact=PreContact(milestone_frame=pf, batter_joint_angles=pre_angles),
        point_of_contact=PointOfContact(
            milestone_frame=cf,
            ball_velocity_kmh=ball_v,
            bat_angle_degrees=round(bat_angle, 1) if bat_angle is not None else None,
            batter_3d_landmarks=dict(lm_c.points) if lm_c else {},
        ),
        post_contact=PostContact(milestone_frame=postf, exit_velocity_kmh=exit_v, launch_angle_degrees=launch),
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


def analyze(video_path: Path, req: AnalysisRequest, session_dir: Path, detectors: Any = None) -> AnalysisResponse:
    if detectors is None:
        raise CapeError(503, "models_unavailable", "Analysis models are not loaded")
    try:
        cal = Calibrator(req.calibration_points, req.pitch_points)
    except ValueError as exc:
        raise CapeError(422, "calibration_invalid", f"Calibration points are invalid: {exc}") from None

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise CapeError(422, "unreadable_video", "Video could not be decoded")
    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
        fps = fps if math.isfinite(fps) and fps > 0 else DEFAULT_FPS
        width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        scan = _Pass(req, cal, detectors, fps, width)
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
