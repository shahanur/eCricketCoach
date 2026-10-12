"""3D joint angles and pose metrics (spec §9, §11.3).

Metric keys returned here are referenced by `rules/coaching_rules.yaml`; keep them stable.
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

import numpy as np

from app.schemas import Handedness, Point3

if TYPE_CHECKING:
    from app.models.base import Landmarks

_EPS = 1e-9

# name -> (A, B vertex, C) as MediaPipe landmark suffixes
_ANGLES: dict[str, tuple[str, str, str]] = {
    "elbow": ("shoulder", "elbow", "wrist"),
    "knee": ("hip", "knee", "ankle"),
    "shoulder": ("elbow", "shoulder", "hip"),
}


def joint_angle(a: Point3, b: Point3, c: Point3) -> float:
    """Angle ABC in degrees with vertex `b`."""
    ba = np.subtract(a, b, dtype=np.float64)
    bc = np.subtract(c, b, dtype=np.float64)
    norm_ba, norm_bc = np.linalg.norm(ba), np.linalg.norm(bc)
    if norm_ba < _EPS or norm_bc < _EPS:
        raise ValueError("zero-length segment")
    cos = float(np.dot(ba, bc) / (norm_ba * norm_bc))
    return math.degrees(math.acos(max(-1.0, min(1.0, cos))))


def _sides(handedness: Handedness | str) -> tuple[str, str]:
    """(front, back) landmark prefixes; front side = left for a right-hander."""
    return ("left", "right") if Handedness(handedness) is Handedness.right else ("right", "left")


sides = _sides
ANGLE_METRICS = frozenset(f"{role}_{joint}" for role in ("front", "back") for joint in _ANGLES)


def angle_points(lm: Landmarks, handedness: Handedness | str, metric: str) -> tuple[Point3, Point3, Point3] | None:
    """Landmarks (A, B vertex, C) behind an angle metric such as `front_knee`, or None."""
    role, _, joint = metric.partition("_")
    if role not in ("front", "back") or joint not in _ANGLES:
        return None
    side = _sides(handedness)[0 if role == "front" else 1]
    keys = [f"{side}_{n}" for n in _ANGLES[joint]]
    if not all(k in lm.points for k in keys):
        return None
    return tuple(lm.points[k] for k in keys)  # type: ignore[return-value]


def batter_angles(lm: Landmarks, handedness: Handedness | str) -> dict[str, float]:
    pts = lm.points
    out: dict[str, float] = {}
    for role, side in zip(("front", "back"), _sides(handedness)):
        for joint, names in _ANGLES.items():
            keys = [f"{side}_{n}" for n in names]
            if all(k in pts for k in keys):
                try:
                    out[f"{role}_{joint}"] = joint_angle(*(pts[k] for k in keys))
                except ValueError:
                    continue
    return out


def _mid(p: Point3, q: Point3) -> np.ndarray:
    return (np.asarray(p[:2], np.float64) + np.asarray(q[:2], np.float64)) / 2


def torso_length(lm: Landmarks) -> float | None:
    """2D distance between shoulder centre and hip centre (image units)."""
    pts = lm.points
    keys = ("left_shoulder", "right_shoulder", "left_hip", "right_hip")
    if not all(k in pts for k in keys):
        return None
    length = float(np.linalg.norm(_mid(pts[keys[0]], pts[keys[1]]) - _mid(pts[keys[2]], pts[keys[3]])))
    return length if length > _EPS else None


def _forward_sign(lm: Landmarks, front: str, back: str) -> float | None:
    """+1 if the batter faces +x in the image (front ankle/hip right of back), else -1."""
    pts = lm.points
    for joint in ("ankle", "hip"):
        f, b = pts.get(f"{front}_{joint}"), pts.get(f"{back}_{joint}")
        if f is not None and b is not None and abs(f[0] - b[0]) > _EPS:
            return 1.0 if f[0] > b[0] else -1.0
    return None


def pose_metrics(lm: Landmarks, handedness: Handedness | str) -> dict[str, float]:
    """Angles plus balance/position metrics. Missing landmarks just omit the affected keys.

    Point-valued metrics are flattened to `<name>_x` / `<name>_y` (image units) so the
    result stays `dict[str, float]`.
    """
    pts = lm.points
    front, back = _sides(handedness)
    out = batter_angles(lm, handedness)

    torso = torso_length(lm)
    if torso is not None:
        out["torso_length"] = torso

    if "left_hip" in pts and "right_hip" in pts:
        out["hip_center_x"], out["hip_center_y"] = map(float, _mid(pts["left_hip"], pts["right_hip"]))
    for role, side in (("front", front), ("back", back)):
        ankle = pts.get(f"{side}_ankle")
        if ankle is not None:
            out[f"{role}_ankle_x"], out[f"{role}_ankle_y"] = float(ankle[0]), float(ankle[1])

    nose, knee = pts.get("nose"), pts.get(f"{front}_knee")
    sign = _forward_sign(lm, front, back)
    if torso is not None and nose is not None and knee is not None and sign is not None:
        out["head_front_knee_offset_pct"] = (nose[0] - knee[0]) * sign / torso * 100
    return out


def head_travel_pct(lm_a: Landmarks, lm_b: Landmarks) -> float | None:
    """2D nose displacement between two milestones as % of the mean torso length."""
    a, b = lm_a.points.get("nose"), lm_b.points.get("nose")
    torsos = [t for t in (torso_length(lm_a), torso_length(lm_b)) if t is not None]
    if a is None or b is None or not torsos:
        return None
    return math.hypot(b[0] - a[0], b[1] - a[1]) / (sum(torsos) / len(torsos)) * 100
