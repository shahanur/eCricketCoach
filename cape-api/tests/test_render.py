import math

import cv2
import numpy as np
import pytest

from app.render import (
    STATUS_COLORS,
    draw_angle,
    draw_contact,
    draw_metrics,
    draw_pitch_map,
    draw_trail,
    export_artifacts,
    pitch_to_map_px,
)
from app.schemas import (
    ARTIFACT_NAMES,
    LENGTH_ZONES_M,
    BowlerType,
    Delivery,
    LengthZone,
    LineZone,
    line_offset_m,
)


@pytest.fixture
def frame():
    return np.full((360, 640, 3), 40, np.uint8)


def changed(a, b):
    return int(np.any(a != b, axis=2).sum())


@pytest.mark.parametrize(
    "draw",
    [
        lambda f: draw_trail(f, [(10, 10), (100, 50), (200, 80), (300, 300)]),
        lambda f: draw_metrics(f, ["Speed: 118 km/h", "Front knee: 132"]),
        lambda f: draw_contact(f, (320, 180)),
        lambda f: draw_angle(f, (300, 100), (320, 180), (400, 200), 104.0, "warn"),
    ],
)
def test_overlays_keep_shape_and_do_not_mutate(frame, draw):
    before = frame.copy()
    out = draw(frame)
    assert out.shape == frame.shape and out.dtype == np.uint8
    assert np.array_equal(frame, before)
    assert changed(out, frame) > 0


def test_trail_fades_older_segments(frame):
    pts = [(20 + 60 * i, 180) for i in range(10)]
    out = draw_trail(frame, pts, color=(0, 255, 255), base_thickness=8)
    old, new = out[170:191, 30:70], out[170:191, 510:550]
    assert changed(old, frame[170:191, 30:70]) < changed(new, frame[170:191, 510:550])
    assert old[..., 2].max() < new[..., 2].max()  # lower alpha -> less of the colour blended in
    assert np.array_equal(draw_trail(frame, [(5, 5)]), frame)
    assert np.array_equal(draw_trail(frame, []), frame)


def test_trail_offscreen_points_safe(frame):
    out = draw_trail(frame, [(-500, -500), (-400, -300), (2000, 2000)])
    assert out.shape == frame.shape


def test_angle_arc_colour_by_status(frame):
    for status, color in STATUS_COLORS.items():
        out = draw_angle(frame, (320, 60), (320, 180), (440, 180), 90, status)
        # Point on the arc bisector at 45° between up and right (image coords), inside radius.
        r = int(max(6, min(30 * 0.5, 120 * 0.4)))
        x = 320 + round(r * math.cos(math.radians(-45)))
        y = 180 + round(r * math.sin(math.radians(-45)))
        patch = out[y - 2 : y + 3, x - 2 : x + 3].reshape(-1, 3).astype(int)
        assert np.min(np.abs(patch - color).sum(axis=1)) < 60
    with pytest.raises(ValueError):
        draw_angle(frame, (0, 0), (1, 1), (2, 0), 90, "bad")


def delivery(x, y, bowler_type="pace", handedness="right"):
    length_zone = next(z for z, lo, hi in LENGTH_ZONES_M[BowlerType(bowler_type)] if lo <= y < hi)
    return Delivery(
        speed_kmh=118,
        pitching_point_m=(x, y),
        length_m=y,
        length_zone=length_zone,
        line_zone=LineZone.off_stump_channel if 0.15 <= line_offset_m(x, handedness) < 0.45 else LineZone.stumps,
        is_good_ball=length_zone is LengthZone.good_length,
    )


@pytest.mark.parametrize(
    "y,bowler_type,zone",
    [(6.5, "pace", LengthZone.good_length), (1.0, "pace", LengthZone.yorker), (4.0, "spin", LengthZone.good_length), (12.0, "pace", LengthZone.short)],
)
def test_pitch_map_places_point_in_band(y, bowler_type, zone):
    d = delivery(-0.3, y, bowler_type)
    img = draw_pitch_map(d, bowler_type=bowler_type)
    assert img.shape == (900, 400, 3) and img.dtype == np.uint8
    u, v = pitch_to_map_px(d.pitching_point_m)
    lo, hi = next((lo, hi) for z, lo, hi in LENGTH_ZONES_M[BowlerType(bowler_type)] if z is zone)
    assert pitch_to_map_px((0, lo))[1] <= v < pitch_to_map_px((0, min(hi, 20.12)))[1]
    expected = STATUS_COLORS["ok" if d.is_good_ball else "fault"]
    assert np.abs(img[v, u].astype(int) - expected).sum() < 30


def test_pitch_map_geometry_and_mirroring():
    assert pitch_to_map_px((0, 0))[1] < pitch_to_map_px((0, 20.12))[1]  # batter at the top
    assert pitch_to_map_px((1.0, 5))[0] > pitch_to_map_px((-1.0, 5))[0]  # +x to the right
    right = draw_pitch_map(delivery(-0.3, 6.5), handedness="right")
    left = draw_pitch_map(delivery(0.3, 6.5, handedness="left"), handedness="left")
    # Off-stump channel shading is mirrored: compare a column inside each channel on a band boundary-free row.
    u_off_r = pitch_to_map_px((-0.3, 15))[0]
    u_off_l = pitch_to_map_px((0.3, 15))[0]
    v = pitch_to_map_px((0, 15))[1]
    assert np.array_equal(right[v, u_off_r], left[v, u_off_l])
    assert not np.array_equal(right[v, u_off_l], right[v, u_off_r])


def test_pitch_map_custom_size():
    assert draw_pitch_map(delivery(0, 6), size=(200, 450)).shape == (450, 200, 3)


def test_export_batter(tmp_path, frame):
    out = export_artifacts(
        tmp_path,
        "batter",
        {"pre_contact": frame, "point_of_contact": frame, "post_contact": frame},
        {"point_of_contact": [lambda f: draw_contact(f, (320, 180)), lambda f: draw_metrics(f, ["x"])]},
    )
    assert list(out) == list(ARTIFACT_NAMES["batter"])
    for name, path in out.items():
        img = cv2.imread(str(path))
        assert img.shape == frame.shape
    contact = cv2.imread(str(out["2_point_of_contact.jpg"]))
    plain = cv2.imread(str(out["1_pre_contact.jpg"]))
    assert changed(contact, plain) > 100
    assert sorted(p.name for p in tmp_path.iterdir()) == sorted(ARTIFACT_NAMES["batter"])


def test_export_bowler_partial(tmp_path, frame):
    pitch_map = draw_pitch_map(delivery(-0.3, 6.5))
    out = export_artifacts(tmp_path, "bowler", {"release": frame, "pitch_map": pitch_map})
    assert set(out) == {"1_release.jpg", "3_pitch_map.jpg"}
    assert cv2.imread(str(out["3_pitch_map.jpg"])).shape == (900, 400, 3)


def test_export_rejects_wrong_milestone(tmp_path, frame):
    with pytest.raises(ValueError):
        export_artifacts(tmp_path, "batter", {"release": frame})


def test_pose_overlays_draw_without_mutating():
    from app.render import draw_alignment, draw_ball, draw_skeleton

    img = np.zeros((400, 300, 3), np.uint8)
    pts = {
        "nose": (150, 60), "left_shoulder": (120, 110), "right_shoulder": (180, 110),
        "left_elbow": (100, 160), "right_elbow": (200, 160), "left_hip": (130, 220),
        "right_hip": (170, 220), "left_knee": (125, 290), "right_knee": (175, 290),
    }
    out = draw_ball(draw_alignment(draw_skeleton(img, pts), (150, 60), (125, 290), (260, 350), "fault"), (260, 350))
    assert not img.any()
    assert out.any()
    assert tuple(out[60, 150]) != (0, 0, 0)
    with pytest.raises(ValueError):
        draw_alignment(img, (1, 1), status="bad")
