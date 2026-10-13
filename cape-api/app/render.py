"""Overlay drawing and milestone image export (spec §5, §11.2, §11.7).

All drawing functions return a new BGR uint8 image and never mutate their input.
"""

from __future__ import annotations

import math
import os
import uuid
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Literal

import cv2
import numpy as np

from app.schemas import (
    ARTIFACT_NAMES,
    LENGTH_ZONES_M,
    LINE_ZONES_M,
    PITCH_LENGTH_M,
    PITCH_WIDTH_M,
    POPPING_CREASE_M,
    STUMPS_WIDTH_M,
    BowlerType,
    Delivery,
    Handedness,
    LengthZone,
    LineZone,
    Point,
    Target,
    pitch_x_from_offset,
)

Status = Literal["ok", "warn", "fault"]
Overlay = Callable[[np.ndarray], np.ndarray]

# BGR
STATUS_COLORS: dict[str, tuple[int, int, int]] = {"ok": (94, 197, 34), "warn": (11, 158, 245), "fault": (68, 68, 239)}
TRAIL_COLOR = (0, 215, 255)
CONTACT_COLOR = (0, 0, 255)
WHITE = (255, 255, 255)
FONT = cv2.FONT_HERSHEY_SIMPLEX
JPEG_QUALITY = 90

ARTIFACT_KEYS: dict[Target, tuple[str, str, str]] = {
    Target.batter: ("pre_contact", "point_of_contact", "post_contact"),
    Target.bowler: ("release", "pitching_point", "pitch_map"),
}


def _ipt(p: Point) -> tuple[int, int]:
    return (int(round(p[0])), int(round(p[1])))


def _ui_scale(img: np.ndarray) -> float:
    return max(0.4, min(img.shape[:2]) / 720)


def _text(img, text, org, scale, color=WHITE, thickness=1) -> None:
    cv2.putText(img, text, org, FONT, scale, (0, 0, 0), thickness + 2, cv2.LINE_AA)
    cv2.putText(img, text, org, FONT, scale, color, thickness, cv2.LINE_AA)


def _blend_rect(img: np.ndarray, x0: int, y0: int, x1: int, y1: int, color, alpha: float) -> None:
    h, w = img.shape[:2]
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
    if x1 <= x0 or y1 <= y0:
        return
    roi = img[y0:y1, x0:x1]
    roi[:] = cv2.addWeighted(roi, 1 - alpha, np.full_like(roi, color), alpha, 0)


# --- frame overlays -----------------------------------------------------------


def draw_trail(frame: np.ndarray, pts: Sequence[Point], color=TRAIL_COLOR, base_thickness: int = 6) -> np.ndarray:
    """Fading polyline, oldest first: alpha_i = i / len(pts), T_i = base × alpha_i (spec §5)."""
    out = frame.copy()
    n = len(pts)
    h, w = out.shape[:2]
    for i in range(1, n):
        alpha = i / n
        t = max(1, int(round(base_thickness * alpha)))
        p0, p1 = _ipt(pts[i - 1]), _ipt(pts[i])
        pad = t + 2
        x0, x1 = max(0, min(p0[0], p1[0]) - pad), min(w, max(p0[0], p1[0]) + pad + 1)
        y0, y1 = max(0, min(p0[1], p1[1]) - pad), min(h, max(p0[1], p1[1]) + pad + 1)
        if x1 <= x0 or y1 <= y0:
            continue
        roi = out[y0:y1, x0:x1]
        layer = roi.copy()
        cv2.line(layer, (p0[0] - x0, p0[1] - y0), (p1[0] - x0, p1[1] - y0), color, t, cv2.LINE_AA)
        roi[:] = cv2.addWeighted(layer, alpha, roi, 1 - alpha, 0)
    return out


def draw_metrics(frame: np.ndarray, lines: Sequence[str]) -> np.ndarray:
    """Semi-transparent text panel in the top-left corner."""
    out = frame.copy()
    if not lines:
        return out
    scale = 0.6 * _ui_scale(out)
    thickness = max(1, int(round(scale * 1.6)))
    sizes = [cv2.getTextSize(s, FONT, scale, thickness)[0] for s in lines]
    line_h = max(s[1] for s in sizes) + int(12 * scale)
    pad = int(12 * scale) + 4
    _blend_rect(out, 0, 0, max(s[0] for s in sizes) + 2 * pad, line_h * len(lines) + 2 * pad, (20, 20, 20), 0.6)
    for i, s in enumerate(lines):
        cv2.putText(out, s, (pad, pad + line_h * (i + 1) - int(6 * scale)), FONT, scale, WHITE, thickness, cv2.LINE_AA)
    return out


def draw_contact(frame: np.ndarray, point: Point) -> np.ndarray:
    out = frame.copy()
    s = _ui_scale(out)
    c, r = _ipt(point), max(6, int(18 * s))
    cv2.circle(out, c, r, CONTACT_COLOR, max(2, int(3 * s)), cv2.LINE_AA)
    cv2.circle(out, c, r + max(4, int(8 * s)), WHITE, max(1, int(s)), cv2.LINE_AA)
    cv2.circle(out, c, max(2, int(3 * s)), CONTACT_COLOR, -1, cv2.LINE_AA)
    _text(out, "CONTACT", (c[0] + r + 8, c[1] - r), 0.7 * s, CONTACT_COLOR, max(1, int(2 * s)))
    return out


def draw_angle(frame: np.ndarray, a: Point, b: Point, c: Point, value: float, status: Status) -> np.ndarray:
    """Limb segments b-a and b-c with an arc at vertex b, coloured by status, plus a degree label."""
    if status not in STATUS_COLORS:
        raise ValueError(f"unknown status {status!r}")
    out = frame.copy()
    color = STATUS_COLORS[status]
    s = _ui_scale(out)
    th = max(1, int(round(2 * s)))
    pa, pb, pc = _ipt(a), _ipt(b), _ipt(c)
    cv2.line(out, pb, pa, color, th, cv2.LINE_AA)
    cv2.line(out, pb, pc, color, th, cv2.LINE_AA)
    ang_a = math.degrees(math.atan2(a[1] - b[1], a[0] - b[0]))
    ang_c = math.degrees(math.atan2(c[1] - b[1], c[0] - b[0]))
    sweep = (ang_c - ang_a + 540) % 360 - 180  # shortest arc
    shortest = min(math.dist(a, b), math.dist(c, b))
    r = int(max(6, min(30 * s, shortest * 0.4)))
    cv2.ellipse(out, pb, (r, r), 0, ang_a, ang_a + sweep, color, th + 1, cv2.LINE_AA)
    cv2.circle(out, pb, th + 2, color, -1, cv2.LINE_AA)

    # Label on the bisector, outside the arc.
    mid = math.radians(ang_a + sweep / 2)
    label = f"{value:.0f}"
    fs = 0.6 * s
    (tw, tht), _ = cv2.getTextSize(label, FONT, fs, th)
    lx = int(pb[0] + math.cos(mid) * (r + 10 * s + tw / 2) - tw / 2)
    ly = int(pb[1] + math.sin(mid) * (r + 10 * s + tht / 2) + tht / 2)
    _text(out, label, (lx, ly), fs, color, th)
    cv2.circle(out, (lx + tw + max(3, int(4 * s)), ly - tht), max(2, int(3 * s)), color, max(1, th - 1), cv2.LINE_AA)
    return out


SKELETON_EDGES: tuple[tuple[str, str], ...] = (
    ("left_shoulder", "right_shoulder"), ("left_hip", "right_hip"),
    ("left_shoulder", "left_hip"), ("right_shoulder", "right_hip"),
    ("left_shoulder", "left_elbow"), ("left_elbow", "left_wrist"),
    ("right_shoulder", "right_elbow"), ("right_elbow", "right_wrist"),
    ("left_hip", "left_knee"), ("left_knee", "left_ankle"),
    ("right_hip", "right_knee"), ("right_knee", "right_ankle"),
    ("left_ear", "nose"), ("nose", "right_ear"),
)
SKELETON_COLOR = (235, 206, 135)
KEY_JOINTS: dict[str, str] = {
    "nose": "Head", "left_elbow": "L elbow", "right_elbow": "R elbow", "left_knee": "L knee", "right_knee": "R knee",
}
HEAD_COLOR = (255, 0, 255)
BALL_COLOR = (0, 255, 255)
HEAD_GUIDE_COLOR = (255, 0, 255)
ELBOW_COLOR = (255, 255, 0)
KNEE_COLOR = (0, 165, 255)
FOOT_COLOR = (255, 80, 180)
TOE_COLOR = (180, 105, 255)
BAT_COLOR = (255, 100, 0)
SHOULDER_TARGET_COLOR = (255, 180, 0)
BACK_FOOT_COLOR = (180, 255, 0)
INCOMING_COLOR = (0, 215, 255)
OUTGOING_COLOR = (80, 220, 80)


def draw_skeleton(frame: np.ndarray, points: Mapping[str, Sequence[float]]) -> np.ndarray:
    """Body links, a neck line to the shoulder centre, and labelled head/elbow/knee key points."""
    out = frame.copy()
    s = _ui_scale(out)
    th = max(1, int(round(2 * s)))
    pts = {k: (float(v[0]), float(v[1])) for k, v in points.items()}
    for a, b in SKELETON_EDGES:
        if a in pts and b in pts:
            cv2.line(out, _ipt(pts[a]), _ipt(pts[b]), SKELETON_COLOR, th, cv2.LINE_AA)
    if "nose" in pts and "left_shoulder" in pts and "right_shoulder" in pts:
        neck = ((pts["left_shoulder"][0] + pts["right_shoulder"][0]) / 2, (pts["left_shoulder"][1] + pts["right_shoulder"][1]) / 2)
        cv2.line(out, _ipt(pts["nose"]), _ipt(neck), SKELETON_COLOR, th, cv2.LINE_AA)
    for name, p in pts.items():
        if name not in KEY_JOINTS:
            cv2.circle(out, _ipt(p), th + 1, SKELETON_COLOR, -1, cv2.LINE_AA)
    fs = 0.45 * s
    for name, text in KEY_JOINTS.items():
        if name not in pts:
            continue
        c = _ipt(pts[name])
        color = HEAD_COLOR if name == "nose" else WHITE
        r = max(4, int((9 if name == "nose" else 5) * s))
        cv2.circle(out, c, r, color, th, cv2.LINE_AA)
        cv2.circle(out, c, max(2, th), color, -1, cv2.LINE_AA)
        _text(out, text, (c[0] + r + 4, c[1] + r + 4), fs, color, max(1, th - 1))
    return out


def _dashed_line(img: np.ndarray, start: Point, end: Point, color, thickness: int, dash: int = 14) -> None:
    length = math.dist(start, end)
    if length <= 0:
        return
    steps = max(1, math.ceil(length / dash))
    for i in range(0, steps, 2):
        a, b = i / steps, min(1.0, (i + 1) / steps)
        p0 = (start[0] + (end[0] - start[0]) * a, start[1] + (end[1] - start[1]) * a)
        p1 = (start[0] + (end[0] - start[0]) * b, start[1] + (end[1] - start[1]) * b)
        cv2.line(img, _ipt(p0), _ipt(p1), color, thickness, cv2.LINE_AA)


def _direction_arrow(
    img: np.ndarray,
    start: Point,
    end: Point,
    label: str,
    color,
    thickness: int,
    scale: float,
) -> None:
    cv2.arrowedLine(img, _ipt(start), _ipt(end), color, thickness, cv2.LINE_AA, tipLength=0.16)
    midpoint = ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)
    _text(img, label, (round(midpoint[0]) + 8, round(midpoint[1]) - 8), 0.42 * scale, color, max(1, thickness - 1))


def draw_batting_guides(
    frame: np.ndarray,
    points: Mapping[str, Sequence[float]],
    handedness: Handedness | str,
    contact: Point | None,
    incoming_start: Point | None = None,
    outgoing_end: Point | None = None,
    back_foot_crease_line: tuple[Point, Point] | None = None,
) -> np.ndarray:
    """Highlight the measured head, front elbow, knee, foot and their alignment."""
    out = frame.copy()
    pts = {k: (float(v[0]), float(v[1])) for k, v in points.items()}
    front = "left" if Handedness(handedness) is Handedness.right else "right"
    back = "right" if front == "left" else "left"
    joints = (
        ("nose", "HEAD", HEAD_GUIDE_COLOR),
        (f"{front}_elbow", "FRONT ELBOW", ELBOW_COLOR),
        (f"{front}_knee", "FRONT KNEE", KNEE_COLOR),
        (f"{front}_ankle", "FRONT FOOT", FOOT_COLOR),
        (f"{front}_foot_index", "FRONT TOE", TOE_COLOR),
    )
    s = _ui_scale(out)
    thickness = max(2, round(3 * s))
    radius = max(7, round(11 * s))
    for name, label, color in joints:
        if name not in pts:
            continue
        point = _ipt(pts[name])
        cv2.circle(out, point, radius, color, thickness, cv2.LINE_AA)
        cv2.circle(out, point, max(2, thickness), color, -1, cv2.LINE_AA)
        _text(out, label, (point[0] + radius + 5, point[1] - radius), 0.48 * s, color, max(1, thickness - 1))

    head = pts.get("nose")
    knee = pts.get(f"{front}_knee")
    foot = pts.get(f"{front}_ankle")
    toe = pts.get(f"{front}_foot_index")
    front_shoulder = pts.get(f"{front}_shoulder")
    back_shoulder = pts.get(f"{back}_shoulder")
    front_elbow = pts.get(f"{front}_elbow")
    back_foot = pts.get(f"{back}_ankle")
    back_toe = pts.get(f"{back}_foot_index")
    if head is not None and knee is not None:
        _dashed_line(out, head, knee, HEAD_GUIDE_COLOR, thickness)
    if head is not None and toe is not None:
        projected = (head[0], toe[1])
        _dashed_line(out, head, projected, FOOT_COLOR, thickness)
        cv2.line(out, _ipt(toe), _ipt(projected), FOOT_COLOR, thickness, cv2.LINE_AA)
        _text(out, "CHIN / FRONT TOE", (min(_ipt(toe)[0], _ipt(projected)[0]), _ipt(toe)[1] + 24), 0.42 * s, FOOT_COLOR)
    if foot is not None and toe is not None:
        vector = np.subtract(toe, foot, dtype=np.float64)
        length = float(np.linalg.norm(vector))
        if length > 0:
            arrow_end = np.asarray(foot) + vector / length * max(length * 2.0, 80 * s)
            _direction_arrow(out, foot, (float(arrow_end[0]), float(arrow_end[1])), "FOOT / TOE", TOE_COLOR, thickness, s)
    if front_shoulder is not None and back_shoulder is not None and contact is not None:
        cv2.line(out, _ipt(back_shoulder), _ipt(front_shoulder), SHOULDER_TARGET_COLOR, thickness, cv2.LINE_AA)
        _dashed_line(out, front_shoulder, contact, SHOULDER_TARGET_COLOR, thickness)
        _text(
            out,
            "SHOULDER -> TARGET",
            (_ipt(front_shoulder)[0] + 8, _ipt(front_shoulder)[1] - 12),
            0.42 * s,
            SHOULDER_TARGET_COLOR,
            max(1, thickness - 1),
        )
    if front_shoulder is not None and front_elbow is not None:
        reference_end = (front_shoulder[0] + math.copysign(max(80 * s, 1), front_elbow[0] - front_shoulder[0]), front_shoulder[1])
        _dashed_line(out, front_shoulder, reference_end, ELBOW_COLOR, thickness)
        cv2.line(out, _ipt(front_shoulder), _ipt(front_elbow), ELBOW_COLOR, thickness, cv2.LINE_AA)
        _text(out, "HIGH ELBOW", (_ipt(front_elbow)[0] + 8, _ipt(front_elbow)[1] + 22), 0.42 * s, ELBOW_COLOR)
    if back_foot is not None and back_toe is not None:
        _direction_arrow(out, back_foot, back_toe, "BACK FOOT", BACK_FOOT_COLOR, thickness, s)
    if back_foot_crease_line is not None:
        _dashed_line(out, back_foot_crease_line[0], back_foot_crease_line[1], BACK_FOOT_COLOR, thickness)
        _text(
            out,
            "CREASE PARALLEL",
            (_ipt(back_foot_crease_line[0])[0], _ipt(back_foot_crease_line[0])[1] - 10),
            0.42 * s,
            BACK_FOOT_COLOR,
            max(1, thickness - 1),
        )
    if contact is not None:
        c = _ipt(contact)
        cv2.circle(out, c, max(12, round(22 * s)), CONTACT_COLOR, thickness, cv2.LINE_AA)
        _text(out, "BAT-BALL CONTACT", (c[0] + 18, c[1] + 28), 0.5 * s, CONTACT_COLOR, thickness)
        wrists = [pts[name] for name in ("left_wrist", "right_wrist") if name in pts]
        if wrists:
            hands = tuple(np.mean(np.asarray(wrists), axis=0))
            _direction_arrow(out, hands, contact, "BAT DIRECTION", BAT_COLOR, thickness, s)
        if incoming_start is not None:
            _direction_arrow(out, incoming_start, contact, "BALL IN", INCOMING_COLOR, thickness, s)
        if outgoing_end is not None and math.dist(contact, outgoing_end) > 2:
            _direction_arrow(out, contact, outgoing_end, "BALL OUT", OUTGOING_COLOR, thickness, s)
    return out


def draw_alignment(
    frame: np.ndarray, head: Point, knee: Point | None = None, ball: Point | None = None, status: Status = "ok"
) -> np.ndarray:
    """Plumb line from the head (head over front knee) and a dashed head-to-ball sight line."""
    if status not in STATUS_COLORS:
        raise ValueError(f"unknown status {status!r}")
    out = frame.copy()
    s = _ui_scale(out)
    th = max(1, int(round(2 * s)))
    color = STATUS_COLORS[status]
    hx, hy = _ipt(head)
    bottom = out.shape[0] - 1
    if knee is not None:
        bottom = min(bottom, int(knee[1] + 0.25 * abs(knee[1] - head[1])) + 1)
    cv2.line(out, (hx, hy), (hx, bottom), color, th, cv2.LINE_AA)
    if knee is not None:
        kx, ky = _ipt(knee)
        cv2.line(out, (kx, ky), (hx, ky), color, th, cv2.LINE_AA)
        cv2.circle(out, (kx, ky), max(4, int(6 * s)), color, th, cv2.LINE_AA)
        _text(out, "Head vs front knee", (min(hx, kx), ky - max(6, int(8 * s))), 0.45 * s, color, max(1, th - 1))
    if ball is not None:
        bx, by = _ipt(ball)
        length = math.hypot(bx - hx, by - hy)
        step = max(8.0, 14 * s)
        for i in range(int(length // step)):
            if i % 2:
                continue
            t0, t1 = i * step / length, min(1.0, (i + 1) * step / length)
            p0 = (int(hx + (bx - hx) * t0), int(hy + (by - hy) * t0))
            p1 = (int(hx + (bx - hx) * t1), int(hy + (by - hy) * t1))
            cv2.line(out, p0, p1, HEAD_COLOR, th, cv2.LINE_AA)
    return out


def draw_ball(frame: np.ndarray, point: Point) -> np.ndarray:
    out = frame.copy()
    s = _ui_scale(out)
    c, r = _ipt(point), max(6, int(12 * s))
    th = max(1, int(round(2 * s)))
    cv2.circle(out, c, r, BALL_COLOR, th, cv2.LINE_AA)
    cv2.circle(out, c, max(2, int(3 * s)), BALL_COLOR, -1, cv2.LINE_AA)
    _text(out, "Ball", (c[0] + r + 4, c[1] + r), 0.5 * s, BALL_COLOR, th)
    return out


# --- pitch map ----------------------------------------------------------------

_Y_MIN_M, _Y_MAX_M = -1.5, PITCH_LENGTH_M + 1.5
_X_HALF_M = 2.0
_BAND_COLORS = {
    LengthZone.yorker: (70, 70, 70),
    LengthZone.full: (95, 95, 95),
    LengthZone.good_length: (60, 140, 60),
    LengthZone.short_of_a_length: (95, 95, 95),
    LengthZone.short: (70, 70, 70),
}
_BAND_LABELS = {
    LengthZone.yorker: "Yorker",
    LengthZone.full: "Full",
    LengthZone.good_length: "Good length",
    LengthZone.short_of_a_length: "Short of length",
    LengthZone.short: "Short",
}


def pitch_to_map_px(point_m: Point, size: tuple[int, int] = (400, 900)) -> tuple[int, int]:
    """Pitch frame metres -> pitch-map pixels. Viewed from behind the bowler: batter's stumps at the top."""
    w, h = size
    u = w / 2 + point_m[0] * (w / (2 * _X_HALF_M))
    v = (point_m[1] - _Y_MIN_M) * (h / (_Y_MAX_M - _Y_MIN_M))
    return int(round(u)), int(round(v))


def draw_pitch_map(
    delivery: Delivery,
    size: tuple[int, int] = (400, 900),
    bowler_type: BowlerType | str = BowlerType.pace,
    handedness: Handedness | str = Handedness.right,
) -> np.ndarray:
    """Top-down pitch with stumps, labelled length bands, shaded off-stump channel and the pitching point."""
    w, h = size
    img = np.full((h, w, 3), (38, 58, 40), np.uint8)
    px = lambda x, y: pitch_to_map_px((x, y), size)  # noqa: E731
    half = PITCH_WIDTH_M / 2

    # Pitch surface and length bands (batter's half up to the bowler's stumps).
    (x0, y0), (x1, y1) = px(-half, 0), px(half, PITCH_LENGTH_M)
    cv2.rectangle(img, (x0, y0), (x1, y1), (120, 170, 200), -1)
    fs = 0.42 * max(0.8, w / 400)
    for zone, lo, hi in LENGTH_ZONES_M[BowlerType(bowler_type)]:
        _, top = px(0, lo)
        _, bot = px(0, min(hi, PITCH_LENGTH_M))
        alpha = 0.55 if zone is LengthZone.good_length else 0.35
        _blend_rect(img, x0, top, x1 + 1, bot, _BAND_COLORS[zone], alpha)
        cv2.line(img, (x0, top), (x1, top), (230, 230, 230), 1, cv2.LINE_AA)
        if bot - top >= 14:
            label_color = (180, 255, 180) if zone is LengthZone.good_length else WHITE
            _text(img, _BAND_LABELS[zone], (4, (top + bot) // 2 + 5), fs, label_color)

    # Off-stump channel (mirrored for left-handers).
    lo, hi = next((lo, hi) for z, lo, hi in LINE_ZONES_M if z is LineZone.off_stump_channel)
    cx0, cx1 = sorted(pitch_x_from_offset(o, handedness) for o in (lo, hi))
    (u0, _), (u1, _) = px(cx0, 0), px(cx1, 0)
    _, v_end = px(0, PITCH_LENGTH_M)
    _blend_rect(img, u0, y0, u1, v_end, (220, 180, 90), 0.35)

    # Creases and stumps at both ends.
    for y_stumps, y_crease in ((0.0, POPPING_CREASE_M), (PITCH_LENGTH_M, PITCH_LENGTH_M - POPPING_CREASE_M)):
        for y in (y_stumps, y_crease):
            _, v = px(0, y)
            cv2.line(img, (px(-half - 0.3, 0)[0], v), (px(half + 0.3, 0)[0], v), WHITE, 1, cv2.LINE_AA)
        _, v = px(0, y_stumps)
        for dx in (-STUMPS_WIDTH_M / 2, 0.0, STUMPS_WIDTH_M / 2):
            cv2.circle(img, (px(dx, 0)[0], v), 3, (40, 40, 40), -1, cv2.LINE_AA)
    _text(img, "BATTER", (w // 2 - 30, max(14, px(0, 0)[1] - 18)), fs, WHITE)

    # Pitching point.
    u, v = pitch_to_map_px(delivery.pitching_point_m, size)
    u, v = min(max(u, 8), w - 9), min(max(v, 8), h - 9)
    marker = STATUS_COLORS["ok" if delivery.is_good_ball else "fault"]
    cv2.circle(img, (u, v), 9, WHITE, -1, cv2.LINE_AA)
    cv2.circle(img, (u, v), 7, marker, -1, cv2.LINE_AA)
    _text(img, f"{delivery.length_m:.1f} m", (min(u + 12, w - 60), v + 5), fs, WHITE)

    footer = delivery.length_zone.replace("_", " ").capitalize() + ", " + delivery.line_zone.replace("_", " ")
    if delivery.speed_kmh is not None:
        footer += f", {delivery.speed_kmh:.0f} km/h"
    _blend_rect(img, 0, h - 30, w, h, (20, 20, 20), 0.7)
    _text(img, footer, (8, h - 10), fs, WHITE)
    return img


# --- export -------------------------------------------------------------------


def _write_jpeg(path: Path, img: np.ndarray) -> None:
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    if not ok:
        raise RuntimeError(f"failed to encode {path.name}")
    tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    tmp.write_bytes(buf.tobytes())
    os.replace(tmp, path)


def export_artifacts(
    session_dir: Path,
    target: Target | str,
    frames: Mapping[str, np.ndarray],
    overlays: Mapping[str, Sequence[Overlay]] | None = None,
) -> dict[str, Path]:
    """Apply each milestone's overlays (in order, bottom layer first) and write the §11.7 JPEGs.

    Keys are milestone keys from `ARTIFACT_KEYS[target]` (e.g. "point_of_contact", "pitch_map").
    Missing frames are skipped. Returns {artifact file name: path} for the files written.
    """
    target = Target(target)
    keys = ARTIFACT_KEYS[target]
    unknown = (set(frames) | set(overlays or {})) - set(keys)
    if unknown:
        raise ValueError(f"unknown milestone(s) for {target}: {sorted(unknown)}")
    written: dict[str, Path] = {}
    for key, name in zip(keys, ARTIFACT_NAMES[target]):
        if key not in frames:
            continue
        img = frames[key]
        for layer in (overlays or {}).get(key, ()):
            img = layer(img)
        path = Path(session_dir) / name
        _write_jpeg(path, img)
        written[name] = path
    return written
