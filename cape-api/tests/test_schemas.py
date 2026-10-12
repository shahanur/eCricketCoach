import pytest
from pydantic import ValidationError

from app.schemas import (
    ARTIFACT_NAMES,
    AnalysisRequest,
    DownloadEndpoints,
    Target,
)

PTS = [[100, 600], [500, 600], [220, 200], [380, 200]]


def make(**kw):
    base = {"target": "batter", "handedness": "right", "shot_type": "pull", "calibration_points": PTS}
    base.update(kw)
    return AnalysisRequest.model_validate(base)


def test_valid_batter_and_bowler():
    assert make().shot_type == "pull"
    req = make(target="bowler", shot_type=None, bowler_type="spin", pitch_points_m=[[0, 0], [3.05, 0], [0, 20.12], [3.05, 20.12]])
    assert req.bowler_type == "spin" and req.pitch_points_m is not None


@pytest.mark.parametrize(
    "kw",
    [
        {"shot_type": None},
        {"bowler_type": "pace"},
        {"target": "bowler", "shot_type": None},
        {"target": "bowler", "bowler_type": "pace"},
        {"target": "umpire"},
        {"handedness": "both"},
        {"shot_type": "reverse_ramp"},
        {"calibration_points": PTS[:3]},
        {"calibration_points": PTS + [[1, 1]]},
        {"calibration_points": [[1, 1]] * 4},
        {"calibration_points": [[-1, 0], *PTS[1:]]},
        {"calibration_points": [[float("nan"), 0], *PTS[1:]]},
        {"unexpected": 1},
    ],
)
def test_invalid_requests(kw):
    with pytest.raises(ValidationError):
        make(**kw)


@pytest.mark.parametrize("target", list(Target))
def test_download_endpoints(target):
    urls = DownloadEndpoints.for_session("abc", target).model_dump(exclude_none=True)
    assert urls.pop("all_zip") == "/api/v1/artifacts/abc/all.zip"
    assert sorted(u.rsplit("/", 1)[1] for u in urls.values()) == sorted(ARTIFACT_NAMES[target])
