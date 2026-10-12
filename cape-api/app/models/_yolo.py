"""Shared Ultralytics plumbing. `ultralytics` is imported only when a model is first used."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

import numpy as np


class LazyYolo:
    def __init__(self, weights: Path, device: str) -> None:
        self.weights = weights
        self.device = device
        self._model: Any = None
        self._lock = threading.Lock()

    def predict(self, frame: np.ndarray) -> Any:
        """Run one frame and return the first `Results` object (thread-safe)."""
        with self._lock:
            if self._model is None:
                from ultralytics import YOLO

                self._model = YOLO(str(self.weights))
            return self._model.predict(frame, device=self.device, verbose=False)[0]


def to_numpy(t: Any) -> np.ndarray:
    return t.cpu().numpy() if hasattr(t, "cpu") else np.asarray(t)
