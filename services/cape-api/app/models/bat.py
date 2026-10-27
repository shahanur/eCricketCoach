"""Custom YOLOv11-Seg cricket bat segmenter."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from app.models._yolo import LazyYolo, to_numpy

# Pretrained COCO fallback (used until a custom bat-seg.pt exists): "baseball bat".
COCO_BAT_CLASSES = frozenset({34})


class YoloBatSegmenter:
    def __init__(self, weights: Path, device: str, classes: frozenset[int] | None = None) -> None:
        self._yolo = LazyYolo(weights, device)
        self.classes = classes  # None = every mask is a bat (custom single-class model)

    def segment(self, frame: np.ndarray) -> np.ndarray | None:
        """Largest bat mask as an Nx2 float32 polygon in frame pixels."""
        result = self._yolo.predict(frame)
        masks = result.masks
        if masks is None:
            return None
        xy = list(masks.xy)
        if self.classes is not None:
            cls = to_numpy(result.boxes.cls).astype(int)
            xy = [p for p, c in zip(xy, cls) if c in self.classes]
        polys = [np.asarray(p, dtype=np.float32) for p in xy if len(p) >= 3]
        if not polys:
            return None
        return max(polys, key=lambda p: abs(cv2.contourArea(p)))
