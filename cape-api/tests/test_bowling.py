import pytest

from app.bowling import bounce_index, delivery_metrics, length_zone, line_zone
from app.calibration import Calibrator
from app.schemas import DEFAULT_PITCH_POINTS_M, AnalysisRequest, LengthZone, LineZone

FPS = 100.0


def side_on_px(x, y, h=0.0):
    """Synthetic side-on camera: pitch y -> image u, pitch x -> image v; height lifts the ball (v decreases)."""
    return (100 + y * 30, 300 + x * 20 - 2 * h)


PIXELS = [side_on_px(x, y) for x, y in DEFAULT_PITCH_POINTS_M]


def req(handedness="right", bowler_type="pace"):
    return AnalysisRequest(target="bowler", handedness=handedness, bowler_type=bowler_type, calibration_points=PIXELS)


def track(x=-0.3, release_y=18.0, bounce_y=6.5, n_in=30, n_out=10, release_h=2.2):
    pts = []
    for i in range(n_in + 1):
        t = i / n_in
        pts.append((i, side_on_px(x, release_y + (bounce_y - release_y) * t, release_h * (1 - t))))
    step = (bounce_y - release_y) / n_in
    for j in range(1, n_out + 1):
        pts.append((n_in + j, side_on_px(x, bounce_y + step * j, 0.06 * j)))
    return pts


@pytest.fixture
def cal():
    return Calibrator(PIXELS, list(DEFAULT_PITCH_POINTS_M))


def test_good_ball_right_hander(cal):
    tr = track()
    assert bounce_index(tr) == 30
    d = delivery_metrics(tr, cal, FPS, req())
    assert d.pitching_point_m == pytest.approx((-0.3, 6.5), abs=0.01)
    assert d.length_m == pytest.approx(6.5, abs=0.01)
    assert d.length_zone is LengthZone.good_length and d.line_zone is LineZone.off_stump_channel
    assert d.is_good_ball
    # 11.5 m in 0.30 s = 138 km/h; the release is in the air so the ground projection is approximate.
    assert d.speed_kmh == pytest.approx(138, abs=2) and d.speed_kmh == int(d.speed_kmh)
    assert d.speed_tolerance_kmh == 5


def test_left_hander_is_mirrored(cal):
    assert delivery_metrics(track(x=0.3), cal, FPS, req("left")).line_zone is LineZone.off_stump_channel
    d = delivery_metrics(track(x=-0.3), cal, FPS, req("left"))
    assert d.line_zone is LineZone.down_leg and not d.is_good_ball


@pytest.mark.parametrize(
    "bounce_y,bowler_type,zone",
    [(1.0, "pace", LengthZone.yorker), (4.0, "pace", LengthZone.full), (9.0, "pace", LengthZone.short_of_a_length),
     (12.0, "pace", LengthZone.short), (4.0, "spin", LengthZone.good_length), (5.5, "spin", LengthZone.short_of_a_length)],
)
def test_length_zones(cal, bounce_y, bowler_type, zone):
    d = delivery_metrics(track(bounce_y=bounce_y), cal, FPS, req(bowler_type=bowler_type))
    assert d.length_zone is zone
    assert d.is_good_ball is (zone is LengthZone.good_length)


def test_zone_helpers_edges():
    assert length_zone(-0.2, "pace") is LengthZone.yorker
    assert length_zone(5.0, "pace") is LengthZone.good_length
    assert line_zone(0.15) is LineZone.off_stump_channel
    assert line_zone(-0.5) is LineZone.down_leg
    assert line_zone(0.6) is LineZone.wide_of_off


def test_no_bounce_returns_none(cal):
    no_rise = [(f, p) for f, p in track()[:31]]
    assert delivery_metrics(no_rise, cal, FPS, req()) is None
    assert delivery_metrics(track()[:3], cal, FPS, req()) is None
    assert delivery_metrics([], cal, FPS, req()) is None


def test_bounce_with_frame_gaps(cal):
    tr = [p for i, p in enumerate(track()) if i % 3 != 1]  # dropped detections
    d = delivery_metrics(tr, cal, FPS, req())
    assert d.length_zone is LengthZone.good_length
    assert d.speed_kmh == pytest.approx(138, abs=2)


def test_zero_fps_gives_no_speed(cal):
    assert delivery_metrics(track(), cal, 0, req()).speed_kmh is None
