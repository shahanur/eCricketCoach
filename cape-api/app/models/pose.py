"""Off-the-shelf YOLOv11-Pose person detector (17 COCO keypoints)."""

from __future__ import annotations

from pathlib import Path

from app.models._yolo import LazyYolo, to_numpy
from app.models.base import Box, PoseResult


class YoloPoseDetector:
    def __init__(self, weights: Path, device: str, min_conf: float = 0.4) -> None:
        self._yolo = LazyYolo(weights, device)
        self.min_conf = min_conf

    def detect(self, frame) -> list[PoseResult]:
        res = self._yolo.predict(frame)
        if res.boxes is None or len(res.boxes) == 0 or res.keypoints is None:
            return []
        xyxy, conf = to_numpy(res.boxes.xyxy), to_numpy(res.boxes.conf)
        kps = to_numpy(res.keypoints.xy)
        out = [
            PoseResult(
                box=Box(*map(float, xyxy[i]), conf=float(conf[i]), cls=0),
                keypoints=[(float(x), float(y)) for x, y in kps[i]],
            )
            for i in range(len(xyxy))
            if conf[i] >= self.min_conf
        ]
        return sorted(out, key=lambda p: p.box.conf, reverse=True)
