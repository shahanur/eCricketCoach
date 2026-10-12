"""Lazy, cached detector loading. Heavy ML libraries are imported on first inference only."""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

from app.config import Settings
from app.models.ball import COCO_BALL_CLASSES, YoloBallDetector
from app.models.bat import COCO_BAT_CLASSES, YoloBatSegmenter
from app.models.landmarks import MediaPipeLandmarks
from app.models.pose import YoloPoseDetector

log = logging.getLogger(__name__)

WEIGHT_FILES = {"ball": "ball.pt", "pose": "yolo11n-pose.pt", "bat": "bat-seg.pt"}
# Pretrained COCO models used when a custom model hasn't been trained yet (much weaker on cricket footage).
FALLBACK_WEIGHT_FILES = {"ball": "yolo11n.pt", "bat": "yolo11n-seg.pt"}
FALLBACK_BALL_MIN_CONF = 0.15


class MissingWeightsError(RuntimeError):
    pass


@dataclass(frozen=True)
class Detectors:
    ball: YoloBallDetector
    pose: YoloPoseDetector
    bat: YoloBatSegmenter
    landmarks: MediaPipeLandmarks
    device: str
    fallbacks: tuple[str, ...] = ()


_cache: dict[tuple[str, str], Detectors] = {}
_lock = threading.Lock()


def resolve_device(requested: str) -> str:
    if requested != "cuda":
        return "cpu"
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
    except ImportError:
        pass
    log.warning("CAPE_DEVICE=cuda but CUDA is unavailable; falling back to CPU")
    return "cpu"


def load_detectors(settings: Settings) -> Detectors:
    weights_dir = settings.weights_dir.resolve()
    paths = {k: weights_dir / f for k, f in WEIGHT_FILES.items()}
    fallbacks: list[str] = []
    for key, name in FALLBACK_WEIGHT_FILES.items():
        if not paths[key].is_file() and (weights_dir / name).is_file():
            paths[key] = weights_dir / name
            fallbacks.append(key)
    missing = [str(p) for p in paths.values() if not p.is_file()]
    if missing:
        raise MissingWeightsError(f"Model weights not found: {', '.join(missing)} (set CAPE_WEIGHTS_DIR)")
    for key in fallbacks:
        log.warning("No custom %s; using pretrained %s (lower accuracy)", WEIGHT_FILES[key], FALLBACK_WEIGHT_FILES[key])

    key = (str(weights_dir), settings.device)
    with _lock:
        if key not in _cache:
            device = resolve_device(settings.device)
            _cache[key] = Detectors(
                ball=YoloBallDetector(paths["ball"], device, min_conf=FALLBACK_BALL_MIN_CONF, class_map=COCO_BALL_CLASSES)
                if "ball" in fallbacks
                else YoloBallDetector(paths["ball"], device),
                pose=YoloPoseDetector(paths["pose"], device),
                bat=YoloBatSegmenter(paths["bat"], device, classes=COCO_BAT_CLASSES if "bat" in fallbacks else None),
                landmarks=MediaPipeLandmarks(),
                device=device,
                fallbacks=tuple(fallbacks),
            )
        return _cache[key]
