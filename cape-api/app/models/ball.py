"""Custom YOLOv11-Nano ball detector (spec §3.2, §10)."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from app.models._yolo import LazyYolo, to_numpy
from app.models.base import Box

BALL_CLASSES = {0: "cricket_ball", 1: "blurred_ball"}
# Pretrained COCO fallback (used until a custom ball.pt exists): "sports ball" -> cricket_ball.
COCO_BALL_CLASSES = {32: 0}


class YoloBallDetector:
    def __init__(self, weights: Path, device: str, min_conf: float = 0.25, class_map: dict[int, int] | None = None) -> None:
        self._yolo = LazyYolo(weights, device)
        self.min_conf = min_conf
        self.class_map = class_map or {c: c for c in BALL_CLASSES}

    def detect(self, frame: np.ndarray) -> Box | None:
        boxes = self._yolo.predict(frame).boxes
        if boxes is None or len(boxes) == 0:
            return None
        xyxy, conf, cls = to_numpy(boxes.xyxy), to_numpy(boxes.conf), to_numpy(boxes.cls).astype(int)
        keep = np.isin(cls, list(self.class_map)) & (conf >= self.min_conf)
        if not keep.any():
            return None
        i = int(np.flatnonzero(keep)[np.argmax(conf[keep])])
        return Box(*map(float, xyxy[i]), conf=float(conf[i]), cls=self.class_map[int(cls[i])])
