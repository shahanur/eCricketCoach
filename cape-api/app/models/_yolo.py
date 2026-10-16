"""Shared Ultralytics plumbing. `ultralytics` is imported only when a model is first used."""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

import numpy as np

log = logging.getLogger(__name__)


class LazyYolo:
    def __init__(self, weights: Path, device: str) -> None:
        self.weights = weights
        self.device = device
        self._model: Any = None
        self._lock = threading.Lock()

    def predict(self, frame: np.ndarray) -> Any:
        """Run one frame and return the first `Results` object (thread-safe)."""
        with self._lock:
            try:
                return self._load_model().predict(frame, device=self.device, verbose=False)[0]
            except RuntimeError as exc:
                if not self.device.startswith("cuda") or not _is_cuda_error(exc):
                    raise
                log.warning("CUDA inference failed for %s; retrying with CPU: %s", self.weights.name, exc)
                self.device = "cpu"
                self._model = None
                return self._load_model().predict(frame, device="cpu", verbose=False)[0]

    def _load_model(self) -> Any:
        if self._model is None:
            from ultralytics import YOLO

            self._model = YOLO(str(self.weights))
        return self._model


def _is_cuda_error(error: RuntimeError) -> bool:
    message = str(error).lower()
    return any(marker in message for marker in ("cuda", "cudnn", "cublas", "gpu"))


def to_numpy(t: Any) -> np.ndarray:
    return t.cpu().numpy() if hasattr(t, "cpu") else np.asarray(t)
