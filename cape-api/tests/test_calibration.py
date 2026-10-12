import cv2
import numpy as np
import pytest

from app.calibration import Calibrator
from app.schemas import DEFAULT_PITCH_POINTS_M

SQUARE = [(0.0, 0.0), (100.0, 0.0), (100.0, 100.0), (0.0, 100.0)]


def test_identity_scale():
    cal = Calibrator(SQUARE, [(x / 100, y / 100) for x, y in SQUARE])
    assert cal.to_metres((50, 25)) == pytest.approx((0.5, 0.25), abs=1e-12)
    assert cal.to_metres((0, 0)) == pytest.approx((0, 0), abs=1e-12)


def test_perspective_round_trip():
    # Broadcast-style view: far (bowler) end narrower and higher in the frame.
    pixels = [(412.0, 980.0), (1508.0, 980.0), (1012.0, 210.0), (908.0, 210.0)]
    metres = list(DEFAULT_PITCH_POINTS_M)
    cal = Calibrator(pixels, metres)
    for px, m in zip(pixels, metres):
        assert np.allclose(cal.to_metres(px), m, atol=1e-6)

    # Arbitrary pitch points survive metres -> pixels -> metres.
    to_px = cv2.getPerspectiveTransform(np.float32(metres), np.float32(pixels)).astype(np.float64)
    for m in [(0.0, 0.0), (0.3, 5.0), (-1.1, 12.7), (1.4, 19.9)]:
        p = to_px @ np.array([m[0], m[1], 1.0])
        assert np.allclose(cal.to_metres((p[0] / p[2], p[1] / p[2])), m, atol=1e-4)

    # Self-consistent check at the full 1e-6 tolerance using the inverse homography.
    inv = np.linalg.inv(cal.matrix)
    for m in [(0.0, 0.0), (0.3, 5.0), (-1.1, 12.7), (1.4, 19.9)]:
        p = inv @ np.array([m[0], m[1], 1.0])
        assert np.allclose(cal.to_metres((p[0] / p[2], p[1] / p[2])), m, atol=1e-6)


def test_matches_opencv():
    pixels = [(412.0, 980.0), (1508.0, 980.0), (1012.0, 210.0), (908.0, 210.0)]
    cal = Calibrator(pixels, list(DEFAULT_PITCH_POINTS_M))
    cv = cv2.getPerspectiveTransform(np.float32(pixels), np.float32(DEFAULT_PITCH_POINTS_M))
    assert np.allclose(cal.matrix, cv, rtol=1e-4, atol=1e-6)


def test_speed_known_displacement():
    cal = Calibrator(SQUARE, [(x / 10, y / 10) for x, y in SQUARE])  # 10 px = 1 m
    # 30 px down, 40 px across = 5 m in 0.2 s = 25 m/s = 90 km/h
    assert cal.speed_kmh((0, 0), (30, 40), 0.2) == pytest.approx(90.0)
    assert cal.speed_kmh((5, 5), (5, 5), 0.1) == 0.0


@pytest.mark.parametrize("dt", [0, -0.1, float("nan"), float("inf")])
def test_speed_rejects_bad_dt(dt):
    with pytest.raises(ValueError):
        Calibrator(SQUARE, SQUARE).speed_kmh((0, 0), (1, 1), dt)


@pytest.mark.parametrize(
    "pixels",
    [
        SQUARE[:3],
        SQUARE + [(50.0, 50.0)],
        [(0.0, 0.0), (50.0, 50.0), (100.0, 100.0), (0.0, 100.0)],  # 3 collinear
        [(0.0, 0.0), (0.0, 0.0), (100.0, 100.0), (0.0, 100.0)],  # duplicate
        [(1.0, 1.0)] * 4,
        [(0.0, 0.0), (100.0, 0.0), (float("nan"), 100.0), (0.0, 100.0)],
    ],
)
def test_degenerate_pixels_rejected(pixels):
    with pytest.raises(ValueError):
        Calibrator(pixels, SQUARE)


def test_degenerate_metres_rejected():
    with pytest.raises(ValueError):
        Calibrator(SQUARE, [(0.0, 0.0), (1.0, 0.0), (2.0, 0.0), (0.0, 1.0)])


def test_vanishing_line_rejected():
    pixels = [(412.0, 980.0), (1508.0, 980.0), (1012.0, 210.0), (908.0, 210.0)]
    cal = Calibrator(pixels, list(DEFAULT_PITCH_POINTS_M))
    # The image row where the projective denominator is zero.
    g, h, k = cal.matrix[2]
    x = 960.0
    with pytest.raises(ValueError):
        cal.to_metres((x, -(k + g * x) / h))
