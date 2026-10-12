"""Event-driven ball tracking: PRE_CONTACT -> AT_CONTACT -> POST_CONTACT (spec §4)."""

from __future__ import annotations

import math
from enum import StrEnum

import numpy as np

from app.schemas import Point
from app.tracking.kalman import Kalman2D


class Phase(StrEnum):
    PRE_CONTACT = "pre_contact"
    AT_CONTACT = "at_contact"
    POST_CONTACT = "post_contact"


class Tracker:
    """Feed one `update` per decoded frame, in order (`ball=None` when undetected).

    Contact is the vertex of a velocity inversion `V_t · V_{t-1} < 0` where both speeds
    exceed `min_speed_px` (px/frame). It is ignored within the first `warmup` tracked
    points and must be confirmed by `confirm_frames` further detections that keep moving
    away from the incoming direction (debouncing a single outlier). `contact_frame` is
    the vertex frame; `update` returns AT_CONTACT on the confirming frame. The two
    incoming velocities before the vertex must also agree in direction.
    """

    def __init__(
        self,
        min_speed_px: float = 2.0,
        max_gap: int = 8,
        warmup: int = 3,
        confirm_frames: int = 1,
        process_noise: float = 1.0,
        measurement_noise: float = 4.0,
    ) -> None:
        self.min_speed_px = min_speed_px
        self.max_gap = max_gap
        self.warmup = warmup
        self.confirm_frames = confirm_frames
        self._noise = (process_noise, measurement_noise)
        self.phase = Phase.PRE_CONTACT
        self.contact_frame: int | None = None
        self.filled_frames: set[int] = set()
        self._hist: dict[Phase, list[tuple[int, Point]]] = {p: [] for p in Phase}
        self._pre: list[tuple[int, Point]] = []
        self._kf: Kalman2D | None = None
        self._last_frame: int | None = None
        self._last_seen: int | None = None
        self._cursor = -1

    def history(self, phase: Phase) -> list[tuple[int, Point]]:
        return list(self._hist[phase])

    def update(self, frame_idx: int, ball: Point | None) -> Phase:
        if self._last_frame is not None and frame_idx <= self._last_frame:
            raise ValueError("frame_idx must increase")
        self._last_frame = frame_idx
        if self.phase is Phase.PRE_CONTACT:
            if ball is not None:
                self._pre.append((frame_idx, (float(ball[0]), float(ball[1]))))
                self._hist[Phase.PRE_CONTACT] = self._pre
                self._detect_contact()
            return self.phase
        self.phase = Phase.POST_CONTACT
        self._post_step(frame_idx, ball)
        return self.phase

    # -- PRE ----------------------------------------------------------------

    def _velocity(self, a: tuple[int, Point], b: tuple[int, Point]) -> np.ndarray:
        return (np.subtract(b[1], a[1])) / (b[0] - a[0])

    def _is_inversion(self, v_in: np.ndarray, v_out: np.ndarray) -> bool:
        return (
            float(v_in @ v_out) < 0
            and math.hypot(*v_in) > self.min_speed_px
            and math.hypot(*v_out) > self.min_speed_px
        )

    def _detect_contact(self) -> None:
        need = 2 + self.confirm_frames  # vertex + first outgoing + confirmations
        pts = self._pre
        if len(pts) < max(self.warmup, 2) + need:
            return
        vertex_i = len(pts) - need
        v_in = self._velocity(pts[vertex_i - 1], pts[vertex_i])
        v_prev = self._velocity(pts[vertex_i - 2], pts[vertex_i - 1])
        if float(v_prev @ v_in) <= 0:  # approach must be steady, not itself an outlier
            return
        outgoing = [self._velocity(pts[i - 1], pts[i]) for i in range(vertex_i + 1, len(pts))]
        if not all(self._is_inversion(v_in, v) for v in outgoing):
            return
        vertex = pts[vertex_i]
        self.contact_frame = vertex[0]
        self._hist[Phase.PRE_CONTACT] = pts[:vertex_i]
        self._hist[Phase.AT_CONTACT] = [vertex]
        v0 = self._velocity(vertex, pts[vertex_i + 1])
        self._kf = Kalman2D(vertex[1], tuple(v0), *self._noise)
        self._last_seen = self._cursor = vertex[0]
        for f, p in pts[vertex_i + 1 :]:
            self._post_step(f, p)
        self.phase = Phase.AT_CONTACT

    # -- POST ---------------------------------------------------------------

    def _post_step(self, frame_idx: int, ball: Point | None) -> None:
        assert self._kf is not None and self._last_seen is not None
        # Frames skipped by the caller (or between pre-contact detections) are gaps too.
        for f in range(self._cursor + 1, frame_idx):
            self._predict_fill(f)
        self._cursor = frame_idx
        if ball is not None:
            p = self._kf.step(ball)
            self._last_seen = frame_idx
            self._hist[Phase.POST_CONTACT].append((frame_idx, p))
        else:
            self._predict_fill(frame_idx)

    def _predict_fill(self, frame_idx: int) -> None:
        assert self._kf is not None and self._last_seen is not None
        p = self._kf.step(None)
        if frame_idx - self._last_seen <= self.max_gap:
            self._hist[Phase.POST_CONTACT].append((frame_idx, p))
            self.filled_frames.add(frame_idx)
