"""Planar homography mapping image pixels onto the pitch frame (metres)."""

from __future__ import annotations

import math
from itertools import combinations

import numpy as np

from app.schemas import Point

_MIN_AREA_FRACTION = 1e-6


def _as_quad(points: list[Point], label: str) -> np.ndarray:
    arr = np.asarray(points, dtype=np.float64)
    if arr.shape != (4, 2):
        raise ValueError(f"{label} must contain exactly 4 (x, y) points")
    if not np.all(np.isfinite(arr)):
        raise ValueError(f"{label} must be finite")
    span = float(np.ptp(arr, axis=0).max())
    if span <= 0:
        raise ValueError(f"{label} are degenerate")
    for a, b, c in combinations(arr, 3):
        area = abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2
        if area <= _MIN_AREA_FRACTION * span * span:
            raise ValueError(f"{label} contain 3 collinear points")
    return arr


def _homography(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    # Same linear system as cv2.getPerspectiveTransform, solved in float64
    # (OpenCV only accepts float32 points, which costs ~1e-6 m of precision).
    a = np.zeros((8, 8))
    b = np.zeros(8)
    for i, ((x, y), (u, v)) in enumerate(zip(src, dst)):
        a[2 * i] = [x, y, 1, 0, 0, 0, -u * x, -u * y]
        a[2 * i + 1] = [0, 0, 0, x, y, 1, -v * x, -v * y]
        b[2 * i], b[2 * i + 1] = u, v
    try:
        h = np.linalg.solve(a, b)
    except np.linalg.LinAlgError as exc:
        raise ValueError("calibration points are degenerate") from exc
    return np.append(h, 1.0).reshape(3, 3)


class Calibrator:
    def __init__(self, pixel_pts: list[Point], metre_pts: list[Point]) -> None:
        src = _as_quad(pixel_pts, "pixel_pts")
        dst = _as_quad(metre_pts, "metre_pts")
        self.matrix = _homography(src, dst)
        if not np.all(np.isfinite(self.matrix)) or abs(np.linalg.det(self.matrix)) < 1e-12:
            raise ValueError("calibration points are degenerate")
        self.inverse = np.linalg.inv(self.matrix)

    def to_pixels(self, p: Point) -> Point:
        """Pitch metres (ground plane) -> image pixels."""
        x, y, w = self.inverse @ np.array([p[0], p[1], 1.0])
        if abs(w) < 1e-12:
            raise ValueError("point maps to infinity")
        return (float(x / w), float(y / w))

    def to_metres(self, p: Point) -> Point:
        x, y, w = self.matrix @ np.array([p[0], p[1], 1.0])
        if abs(w) < 1e-12:
            raise ValueError("point lies on the vanishing line")
        return (float(x / w), float(y / w))

    def speed_kmh(self, p0: Point, p1: Point, dt: float) -> float:
        if not dt > 0 or not math.isfinite(dt):
            raise ValueError("dt must be a positive number of seconds")
        (x0, y0), (x1, y1) = self.to_metres(p0), self.to_metres(p1)
        return math.hypot(x1 - x0, y1 - y0) / dt * 3.6
