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


def test_manual_frames():
    req = make(manual_frames={"pre_contact": 3, "point_of_contact": 8, "post_contact": 12})
    assert req.manual_frames.point_of_contact == [8]
    req = make(manual_frames={"pre_contact": [5, 1, 5], "point_of_contact": [9, 7], "post_contact": [12, 20]})
    assert req.manual_frames.pre_contact == [1, 5] and req.manual_frames.point_of_contact == [7, 9]
    assert req.manual_frames.last_frame == 20
    req = make(manual_frames={"point_of_contact": [8, 6]})
    assert req.manual_frames.pre_contact == [] and req.manual_frames.post_contact == []
    assert req.manual_frames.last_frame == 8
    req = make(manual_frames={"pre_contact": [], "point_of_contact": [8], "post_contact": [12]})
    assert req.manual_frames.pre_contact == [] and req.manual_frames.post_contact == [12]
    for bad in (
        {"pre_contact": 8, "point_of_contact": 8, "post_contact": 12},
        {"pre_contact": -1, "point_of_contact": 8, "post_contact": 12},
        {"pre_contact": 1, "post_contact": 12},
        {"pre_contact": 1, "point_of_contact": [], "post_contact": 12},
        {"pre_contact": [1, 9], "point_of_contact": [8], "post_contact": [12]},
        {"pre_contact": [1], "point_of_contact": [8, 13], "post_contact": [12]},
        {"point_of_contact": [8], "post_contact": [8]},
        {"pre_contact": list(range(21)), "point_of_contact": [30], "post_contact": [40]},
    ):
        with pytest.raises(ValidationError):
            make(manual_frames=bad)
    with pytest.raises(ValidationError, match="only allowed when target is 'batter'"):
        make(target="bowler", shot_type=None, bowler_type="pace",
             manual_frames={"pre_contact": 1, "point_of_contact": 2, "post_contact": 3})
