"""Detector data types and Protocols shared by the model adapters and the pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

import numpy as np

from app.schemas import Point, Point3

__all__ = [
    "BallDetector",
    "BatSegmenter",
    "Box",
    "LandmarkEstimator",
    "Landmarks",
    "Point",
    "Point3",
    "PoseDetector",
    "PoseResult",
]


@dataclass(frozen=True)
class Box:
    x1: float
    y1: float
    x2: float
    y2: float
    conf: float
    cls: int

    @property
    def center(self) -> Point:
        return ((self.x1 + self.x2) / 2, (self.y1 + self.y2) / 2)

    @property
    def area(self) -> float:
        return max(0.0, self.x2 - self.x1) * max(0.0, self.y2 - self.y1)


@dataclass
class PoseResult:
    box: Box
    keypoints: list[Point]


@dataclass
class Landmarks:
    """Named MediaPipe landmarks in full-frame pixels; z uses the same scale as x."""

    points: dict[str, Point3]


@runtime_checkable
class BallDetector(Protocol):
    def detect(self, frame: np.ndarray) -> Box | None: ...


@runtime_checkable
class PoseDetector(Protocol):
    def detect(self, frame: np.ndarray) -> list[PoseResult]: ...


@runtime_checkable
class BatSegmenter(Protocol):
    def segment(self, frame: np.ndarray) -> np.ndarray | None: ...


@runtime_checkable
class LandmarkEstimator(Protocol):
    def estimate(self, crop: np.ndarray) -> Landmarks | None: ...
