import math
from dataclasses import dataclass

import pytest

from app.kinematics import batter_angles, head_travel_pct, joint_angle, pose_metrics, torso_length


@dataclass
class Lm:  # structural stand-in for models.base.Landmarks
    points: dict


def stance(nose_x: float = 0.0) -> dict:
    """Right-hander facing +x (front = left side). Image y grows downward; torso = 1.0."""
    return {
        "nose": (nose_x, -0.3, 0.0),
        "left_shoulder": (0.1, 0.0, 0.0),
        "right_shoulder": (-0.1, 0.0, 0.0),
        "left_elbow": (0.1, 0.5, 0.0),  # straight down from shoulder
        "left_wrist": (0.6, 0.5, 0.0),  # 90° at elbow
        "right_elbow": (-0.1, 0.5, 0.0),
        "right_wrist": (-0.1, 1.0, 0.0),  # 180° at elbow
        "left_hip": (0.1, 1.0, 0.0),
        "right_hip": (-0.1, 1.0, 0.0),
        "left_knee": (0.5, 1.5, 0.0),
        "left_ankle": (0.5, 2.0, 0.0),
        "right_knee": (-0.3, 1.5, 0.0),
        "right_ankle": (-0.5, 2.0, 0.0),
    }


def mirror(points: dict) -> dict:
    swap = {"left": "right", "right": "left"}
    out = {}
    for name, (x, y, z) in points.items():
        side, _, rest = name.partition("_")
        out[f"{swap[side]}_{rest}" if side in swap else name] = (-x, y, z)
    return out


@pytest.mark.parametrize(
    "a,b,c,expected",
    [
        ((1, 0, 0), (0, 0, 0), (0, 1, 0), 90.0),
        ((1, 0, 0), (0, 0, 0), (-2, 0, 0), 180.0),
        ((1, 0, 0), (0, 0, 0), (3, 0, 0), 0.0),
        ((1, 0, 0), (0, 0, 0), (1, 1, 0), 45.0),
        ((1, 1, 0), (0, 0, 0), (0, 1, 1), 60.0),  # 3D
        ((2, 3, 4), (1, 1, 1), (1 + 1e-9, 1, 1 + 4.0), math.degrees(math.acos(3 / math.sqrt(14)))),
    ],
)
def test_joint_angle(a, b, c, expected):
    assert joint_angle(a, b, c) == pytest.approx(expected, abs=1e-6)


def test_joint_angle_clips_rounding():
    v = (0.1 + 0.2, 0.3, 0.7)
    assert joint_angle(v, (0, 0, 0), tuple(x * 3 for x in v)) == pytest.approx(0.0, abs=1e-5)


@pytest.mark.parametrize("a,c", [((0, 0, 0), (1, 0, 0)), ((1, 0, 0), (0, 0, 0))])
def test_joint_angle_zero_length(a, c):
    with pytest.raises(ValueError):
        joint_angle(a, (0, 0, 0), c)


def test_batter_angles_right_hander():
    angles = batter_angles(Lm(stance()), "right")
    assert set(angles) == {"front_elbow", "back_elbow", "front_knee", "back_knee", "front_shoulder", "back_shoulder"}
    assert angles["front_elbow"] == pytest.approx(90.0)
    assert angles["back_elbow"] == pytest.approx(180.0)
    assert angles["front_shoulder"] == pytest.approx(0.0)


def test_left_hander_mirrors_right_hander():
    right = pose_metrics(Lm(stance(nose_x=0.4)), "right")
    left = pose_metrics(Lm(mirror(stance(nose_x=0.4))), "left")
    for key in ("front_elbow", "back_elbow", "front_knee", "back_knee", "head_front_knee_offset_pct"):
        assert left[key] == pytest.approx(right[key])
    assert left["front_ankle_x"] == pytest.approx(-right["front_ankle_x"])
    # Same mirrored skeleton read with the wrong handedness swaps front/back.
    wrong = batter_angles(Lm(mirror(stance())), "right")
    assert wrong["front_elbow"] == pytest.approx(180.0)


def test_missing_landmarks_skip_metrics():
    pts = stance()
    for k in ("left_wrist", "right_knee", "nose"):
        del pts[k]
    m = pose_metrics(Lm(pts), "right")
    assert "front_elbow" not in m and "back_knee" not in m and "head_front_knee_offset_pct" not in m
    assert m["back_elbow"] == pytest.approx(180.0)
    assert pose_metrics(Lm({}), "right") == {}
    assert torso_length(Lm({"nose": (0, 0, 0)})) is None


def test_degenerate_segment_skipped():
    pts = stance()
    pts["left_wrist"] = pts["left_elbow"]
    assert "front_elbow" not in batter_angles(Lm(pts), "right")


def test_pose_metrics_positions():
    m = pose_metrics(Lm(stance()), "right")
    assert m["torso_length"] == pytest.approx(1.0)
    assert (m["hip_center_x"], m["hip_center_y"]) == pytest.approx((0.0, 1.0))
    assert (m["front_ankle_x"], m["back_ankle_x"]) == pytest.approx((0.5, -0.5))


@pytest.mark.parametrize("nose_x,expected", [(0.7, 20.0), (0.5, 0.0), (0.3, -20.0)])
def test_head_offset_sign(nose_x, expected):
    """Positive = head ahead of front knee (towards the bowler), for either facing direction."""
    assert pose_metrics(Lm(stance(nose_x)), "right")["head_front_knee_offset_pct"] == pytest.approx(expected)
    flipped = {k: (-x, y, z) for k, (x, y, z) in stance(nose_x).items()}  # same batter, camera from other side
    assert pose_metrics(Lm(flipped), "right")["head_front_knee_offset_pct"] == pytest.approx(expected)


def test_head_travel_pct():
    a, b = stance(0.0), stance(0.0)
    b["nose"] = (0.3, -0.7, 0.0)  # moved 0.5 with torso 1.0
    assert head_travel_pct(Lm(a), Lm(b)) == pytest.approx(50.0)
    assert head_travel_pct(Lm(a), Lm(a)) == pytest.approx(0.0)
    del b["nose"]
    assert head_travel_pct(Lm(a), Lm(b)) is None
