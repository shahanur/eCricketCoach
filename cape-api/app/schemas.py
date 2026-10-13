"""Request/response models for CAPE (spec §6.1 extended by §11.1 and §11.6)."""

import math
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Point = tuple[float, float]
Point3 = tuple[float, float, float]


class Target(StrEnum):
    batter = "batter"
    bowler = "bowler"


class Handedness(StrEnum):
    right = "right"
    left = "left"


class ShotType(StrEnum):
    front_foot_drive = "front_foot_drive"
    back_foot_drive = "back_foot_drive"
    forward_defence = "forward_defence"
    backward_defence = "backward_defence"
    pull = "pull"
    cut = "cut"
    sweep = "sweep"


class BowlerType(StrEnum):
    pace = "pace"
    spin = "spin"


class Severity(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


class LengthZone(StrEnum):
    yorker = "yorker"
    full = "full"
    good_length = "good_length"
    short_of_a_length = "short_of_a_length"
    short = "short"


class LineZone(StrEnum):
    down_leg = "down_leg"
    stumps = "stumps"
    off_stump_channel = "off_stump_channel"
    wide_of_off = "wide_of_off"


Milestone = Literal["pre_contact", "point_of_contact", "post_contact", "release", "pitching_point"]

ARTIFACT_NAMES: dict[Target, tuple[str, str, str]] = {
    Target.batter: ("1_pre_contact.jpg", "2_point_of_contact.jpg", "3_post_contact.jpg"),
    Target.bowler: ("1_release.jpg", "2_pitching_point.jpg", "3_pitch_map.jpg"),
}
ZIP_NAME = "all.zip"
ALL_ARTIFACT_NAMES = frozenset(n for names in ARTIFACT_NAMES.values() for n in names)

PITCH_LENGTH_M = 20.12
PITCH_WIDTH_M = 3.05
# Pitch frame (metres): origin = batter's middle stump at ground level, +y towards the bowler,
# +x to the right as seen from the bowler's end. Calibration taps use the same corner order:
# batter-end left, batter-end right, bowler-end right, bowler-end left (left/right from the bowler's end).
DEFAULT_PITCH_POINTS_M: tuple[Point, Point, Point, Point] = (
    (-PITCH_WIDTH_M / 2, 0.0),
    (PITCH_WIDTH_M / 2, 0.0),
    (PITCH_WIDTH_M / 2, PITCH_LENGTH_M),
    (-PITCH_WIDTH_M / 2, PITCH_LENGTH_M),
)
POPPING_CREASE_M = 1.22
STUMPS_WIDTH_M = 0.2286

# Spec §11.4 zone tables: (zone, lower, upper) in metres, lower inclusive.
LENGTH_ZONES_M: dict[BowlerType, tuple[tuple[LengthZone, float, float], ...]] = {
    BowlerType.pace: (
        (LengthZone.yorker, 0.0, 2.0),
        (LengthZone.full, 2.0, 5.0),
        (LengthZone.good_length, 5.0, 8.0),
        (LengthZone.short_of_a_length, 8.0, 10.0),
        (LengthZone.short, 10.0, math.inf),
    ),
    BowlerType.spin: (
        (LengthZone.yorker, 0.0, 1.0),
        (LengthZone.full, 1.0, 3.0),
        (LengthZone.good_length, 3.0, 5.0),
        (LengthZone.short_of_a_length, 5.0, 6.0),
        (LengthZone.short, 6.0, math.inf),
    ),
}
# Offset from middle stump, positive = off side.
LINE_ZONES_M: tuple[tuple[LineZone, float, float], ...] = (
    (LineZone.down_leg, -math.inf, -0.15),
    (LineZone.stumps, -0.15, 0.15),
    (LineZone.off_stump_channel, 0.15, 0.45),
    (LineZone.wide_of_off, 0.45, math.inf),
)


def line_offset_m(x: float, handedness: "Handedness | str") -> float:
    """Pitch-frame x -> offset from middle stump (+ = off side). Off side is -x for a right-hander."""
    return -x if Handedness(handedness) is Handedness.right else x


def pitch_x_from_offset(offset: float, handedness: "Handedness | str") -> float:
    return line_offset_m(offset, handedness)

QuadPoints = Annotated[list[Point], Field(min_length=4, max_length=4)]


class CapeError(Exception):
    """Raised anywhere in the pipeline to produce a 4xx JSON error."""

    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target: Target
    handedness: Handedness
    shot_type: ShotType | None = None
    bowler_type: BowlerType | None = None
    calibration_points: QuadPoints
    pitch_points_m: QuadPoints | None = None

    @property
    def pitch_points(self) -> list[Point]:
        return list(self.pitch_points_m or DEFAULT_PITCH_POINTS_M)
    @model_validator(mode="after")
    def _check(self) -> "AnalysisRequest":
        if self.target is Target.batter:
            if self.shot_type is None:
                raise ValueError("shot_type is required when target is 'batter'")
            if self.bowler_type is not None:
                raise ValueError("bowler_type is only allowed when target is 'bowler'")
        else:
            if self.bowler_type is None:
                raise ValueError("bowler_type is required when target is 'bowler'")
            if self.shot_type is not None:
                raise ValueError("shot_type is only allowed when target is 'batter'")
        for name in ("calibration_points", "pitch_points_m"):
            pts = getattr(self, name) or []
            if any(not math.isfinite(v) for p in pts for v in p):
                raise ValueError(f"{name} must contain finite numbers")
            if len(set(pts)) != len(pts):
                raise ValueError(f"{name} must contain 4 distinct points")
        if any(v < 0 for p in self.calibration_points for v in p):
            raise ValueError("calibration_points must be non-negative pixel coordinates")
        return self


class Metadata(BaseModel):
    resolution: str
    framerate_fps: float
    selected_target: Target
    target: Target
    handedness: Handedness
    shot_type: ShotType | None = None
    bowler_type: BowlerType | None = None


class PreContact(BaseModel):
    milestone_frame: int
    batter_joint_angles: dict[str, float] = Field(default_factory=dict)


class PointOfContact(BaseModel):
    milestone_frame: int
    selection_source: Literal["gemini", "detector"] = "detector"
    selection_confidence: float | None = Field(default=None, ge=0, le=1)
    ball_velocity_kmh: float | None = None
    estimated_ball_momentum_kg_m_s: float | None = None
    estimated_ball_kinetic_energy_j: float | None = None
    bat_angle_degrees: float | None = None
    head_front_knee_offset_pct: float | None = None
    stride_m: float | None = None
    front_foot_to_contact_angle_degrees: float | None = None
    front_toe_contact_distance_cm: float | None = None
    chin_front_toe_offset_pct: float | None = None
    front_shoulder_target_angle_degrees: float | None = None
    back_foot_crease_angle_degrees: float | None = None
    front_elbow_height_pct: float | None = None
    ball_line: LineZone | None = None
    batter_joint_angles: dict[str, float] = Field(default_factory=dict)
    batter_3d_landmarks: dict[str, Point3] = Field(default_factory=dict)


class PostContact(BaseModel):
    milestone_frame: int
    exit_velocity_kmh: float | None = None
    estimated_ball_momentum_kg_m_s: float | None = None
    estimated_ball_kinetic_energy_j: float | None = None
    launch_angle_degrees: float | None = None
    batter_joint_angles: dict[str, float] = Field(default_factory=dict)


class Release(BaseModel):
    milestone_frame: int
    bowler_joint_angles: dict[str, float] = Field(default_factory=dict)
    release_height_m: float | None = None


class AnalyticsPayload(BaseModel):
    pre_contact: PreContact | None = None
    point_of_contact: PointOfContact | None = None
    post_contact: PostContact | None = None
    release: Release | None = None


class Delivery(BaseModel):
    speed_kmh: float | None = None
    speed_tolerance_kmh: float = 5
    pitching_point_m: Point
    length_m: float
    length_zone: LengthZone
    line_zone: LineZone
    is_good_ball: bool


class Fault(BaseModel):
    code: str
    milestone: Milestone
    metric: str
    value: float
    expected: tuple[float | None, float | None]
    severity: Severity
    message: str
    recommendation: str
    drill: str | None = None


class Coaching(BaseModel):
    score: int = Field(ge=0, le=100)
    verdict: str
    faults: list[Fault] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    unavailable: list[str] = Field(default_factory=list)
    summary: str | None = None


class DownloadEndpoints(BaseModel):
    pre_contact_snapshot: str | None = None
    impact_snapshot: str | None = None
    post_contact_snapshot: str | None = None
    release_snapshot: str | None = None
    pitching_point_snapshot: str | None = None
    pitch_map: str | None = None
    all_zip: str

    @classmethod
    def for_session(cls, session_id: str, target: Target, base: str = "/api/v1/artifacts") -> "DownloadEndpoints":
        keys = (
            ("pre_contact_snapshot", "impact_snapshot", "post_contact_snapshot")
            if target is Target.batter
            else ("release_snapshot", "pitching_point_snapshot", "pitch_map")
        )
        urls = {k: f"{base}/{session_id}/{name}" for k, name in zip(keys, ARTIFACT_NAMES[target])}
        return cls(**urls, all_zip=f"{base}/{session_id}/{ZIP_NAME}")


class AnalysisResponse(BaseModel):
    status: Literal["success"] = "success"
    session_id: str
    metadata: Metadata
    analytics_payload: AnalyticsPayload
    delivery: Delivery | None = None
    coaching: Coaching
    download_endpoints: DownloadEndpoints


class ErrorResponse(BaseModel):
    status: Literal["error"] = "error"
    error: str
    message: str
    details: list[dict] | None = None
