"""MediaPipe Pose run on a cropped player ROI only (spec §3.2)."""

from __future__ import annotations

import threading
from collections.abc import Iterable
from typing import Any

import cv2
import numpy as np

from app.models.base import Box, Landmarks

# MediaPipe Pose landmark order (33 points).
LANDMARK_NAMES: tuple[str, ...] = (
    "nose", "left_eye_inner", "left_eye", "left_eye_outer", "right_eye_inner", "right_eye",
    "right_eye_outer", "left_ear", "right_ear", "mouth_left", "mouth_right", "left_shoulder",
    "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_pinky",
    "right_pinky", "left_index", "right_index", "left_thumb", "right_thumb", "left_hip",
    "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle", "left_heel",
    "right_heel", "left_foot_index", "right_foot_index",
)  # fmt: skip
FOOT_LANDMARK_NAMES = frozenset(("left_heel", "right_heel", "left_foot_index", "right_foot_index"))
FOOT_MIN_VISIBILITY = 0.2


def crop_roi(frame: np.ndarray, box: Box, pad: float = 0.15) -> tuple[np.ndarray, tuple[int, int]] | None:
    """Crop `box` grown by `pad` × its size on every side, clamped to the frame.

    Returns `(crop, (x0, y0))` where `(x0, y0)` is the crop's top-left in frame pixels,
    or `None` if nothing of the box lies inside the frame.
    """
    h, w = frame.shape[:2]
    bw, bh = box.x2 - box.x1, box.y2 - box.y1
    x0 = max(0, int(np.floor(box.x1 - bw * pad)))
    y0 = max(0, int(np.floor(box.y1 - bh * pad)))
    x1 = min(w, int(np.ceil(box.x2 + bw * pad)))
    y1 = min(h, int(np.ceil(box.y2 + bh * pad)))
    if x1 <= x0 or y1 <= y0:
        return None
    return frame[y0:y1, x0:x1], (x0, y0)


def remap_landmarks(
    raw: Iterable[Any],
    offset: tuple[int, int],
    crop_size: tuple[int, int],
    min_visibility: float = 0.5,
) -> Landmarks | None:
    """Convert crop-normalised MediaPipe landmarks to full-frame pixels.

    `crop_size` is `(width, height)`. z is scaled by the crop width (MediaPipe's z uses
    the same scale as x), keeping the 3D coordinates isotropic for joint angles.
    """
    x0, y0 = offset
    cw, ch = crop_size
    points = {
        name: (x0 + lm.x * cw, y0 + lm.y * ch, lm.z * cw)
        for name, lm in zip(LANDMARK_NAMES, raw)
        if getattr(lm, "visibility", 1.0)
        >= (min(min_visibility, FOOT_MIN_VISIBILITY) if name in FOOT_LANDMARK_NAMES else min_visibility)
    }
    return Landmarks(points) if points else None


class MediaPipeLandmarks:
    def __init__(self, min_visibility: float = 0.5, model_complexity: int = 2) -> None:
        self.min_visibility = min_visibility
        self.model_complexity = model_complexity
        self._pose: Any = None
        self._lock = threading.Lock()

    def _process(self, rgb: np.ndarray) -> Any:
        with self._lock:
            if self._pose is None:
                import mediapipe as mp

                self._pose = mp.solutions.pose.Pose(
                    static_image_mode=True, model_complexity=self.model_complexity
                )
            return self._pose.process(rgb)

    def estimate(self, crop: np.ndarray) -> Landmarks | None:
        """Landmarks in crop pixels (use `estimate_in_frame` for full-frame coordinates)."""
        return self._estimate(crop, (0, 0))

    def estimate_in_frame(self, frame: np.ndarray, box: Box, pad: float = 0.15) -> Landmarks | None:
        roi = crop_roi(frame, box, pad)
        return None if roi is None else self._estimate(*roi)

    def _estimate(self, crop: np.ndarray, offset: tuple[int, int]) -> Landmarks | None:
        if crop.size == 0:
            return None
        result = self._process(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
        if result.pose_landmarks is None:
            return None
        h, w = crop.shape[:2]
        return remap_landmarks(result.pose_landmarks.landmark, offset, (w, h), self.min_visibility)
