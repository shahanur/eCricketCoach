"""Delivery speed, pitching point, length and line (spec §11.4)."""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

from app.schemas import (
    LENGTH_ZONES_M,
    LINE_ZONES_M,
    AnalysisRequest,
    BowlerType,
    Delivery,
    LengthZone,
    LineZone,
    Point,
    line_offset_m,
)

if TYPE_CHECKING:
    from app.calibration import Calibrator

GOOD_LINES = frozenset({LineZone.stumps, LineZone.off_stump_channel})


def length_zone(length_m: float, bowler_type: BowlerType | str) -> LengthZone:
    length = max(0.0, length_m)
    return next(z for z, lo, hi in LENGTH_ZONES_M[BowlerType(bowler_type)] if lo <= length < hi)


def line_zone(offset_m: float) -> LineZone:
    return next(z for z, lo, hi in LINE_ZONES_M if lo <= offset_m < hi)


def bounce_index(ball_track: list[tuple[int, Point]], settled: bool = False) -> int | None:
    """Index of the first bounce: image-y velocity (3-point smoothed) turns from down (+) to up (-).

    `settled=True` ignores turns whose smoothing still depends on the edge-padded last point, so
    the answer cannot change as more points arrive (used while streaming frames).
    """
    if len(ball_track) < 4:
        return None
    frames = np.array([f for f, _ in ball_track], np.float64)
    ys = np.array([p[1] for _, p in ball_track], np.float64)
    smooth = np.convolve(np.pad(ys, 1, mode="edge"), np.ones(3) / 3, mode="valid")
    vel = np.diff(smooth) / np.maximum(np.diff(frames), 1)
    for i in range(1, len(vel)):
        if settled and i + 1 > len(ys) - 2:
            break
        if vel[i - 1] > 0 and vel[i] < 0:
            # vel[i-1] spans points i-1 -> i; the true vertex is the lowest raw point nearby.
            lo, hi = max(0, i - 1), min(len(ys), i + 2)
            return lo + int(np.argmax(ys[lo:hi]))
    return None


def delivery_metrics(
    ball_track: list[tuple[int, Point]], cal: Calibrator, fps: float, req: AnalysisRequest
) -> Delivery | None:
    idx = bounce_index(ball_track)
    if idx is None or idx == 0:
        return None
    (f0, release), (f1, pitch) = ball_track[0], ball_track[idx]
    try:
        x, y = cal.to_metres(pitch)
    except ValueError:
        return None
    speed = None
    if fps > 0 and f1 > f0:
        try:
            speed = float(round(cal.speed_kmh(release, pitch, (f1 - f0) / fps)))
        except ValueError:
            speed = None
    bowler_type = req.bowler_type or BowlerType.pace
    lz = length_zone(y, bowler_type)
    nz = line_zone(line_offset_m(x, req.handedness))
    return Delivery(
        speed_kmh=speed,
        pitching_point_m=(round(x, 3), round(y, 3)),
        length_m=round(y, 2),
        length_zone=lz,
        line_zone=nz,
        is_good_ball=lz is LengthZone.good_length and nz in GOOD_LINES,
    )
