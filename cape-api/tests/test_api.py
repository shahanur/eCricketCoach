import io
import json
import zipfile

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import pipeline, workspace
from app.config import Settings
from app.main import create_app
from app.schemas import CapeError

W, H = 64, 48
PTS = [[5, 40], [60, 40], [40, 5], [20, 5]]


@pytest.fixture(scope="module")
def video_bytes(tmp_path_factory) -> bytes:
    path = tmp_path_factory.mktemp("vid") / "clip.avi"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 30, (W, H))
    for i in range(10):
        frame = np.full((H, W, 3), i * 20, np.uint8)
        writer.write(frame)
    writer.release()
    return path.read_bytes()


@pytest.fixture
def settings(tmp_path):
    return Settings(workspace_dir=tmp_path / "ws", weights_dir=tmp_path / "no-weights", max_upload_mb=1)


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as c:
        yield c


def form(**kw):
    base = {"target": "batter", "handedness": "right", "shot_type": "pull", "calibration_points": json.dumps(PTS)}
    base.update(kw)
    return {k: v for k, v in base.items() if v is not None}


def post(client, data, content=b"\x00" * 10, filename="clip.avi", ctype="video/x-msvideo"):
    return client.post("/api/v1/analyze-cricket-video", data=data, files={"file": (filename, content, ctype)})


def sessions(settings):
    root = settings.workspace_dir
    return list(root.iterdir()) if root.exists() else []


@pytest.mark.parametrize(
    "data",
    [
        form(target="umpire"),
        form(handedness="both"),
        form(shot_type="reverse_ramp"),
        form(shot_type=None),
        form(target="bowler", shot_type=None),
        form(calibration_points=json.dumps(PTS[:3])),
        form(calibration_points="not json"),
        form(calibration_points=None),
        form(pitch_points_m=json.dumps([[0, 0]])),
    ],
)
def test_validation_errors(client, settings, data):
    r = post(client, data)
    assert r.status_code == 422, r.text
    assert r.json()["error"] == "validation_error"
    assert sessions(settings) == []


@pytest.mark.parametrize(
    "filename,ctype",
    [("clip.exe", "video/mp4"), ("clip", "video/mp4"), ("clip.mp4", "text/plain"), ("clip.mp4", "image/jpeg")],
)
def test_bad_file_type(client, filename, ctype):
    r = post(client, form(), filename=filename, ctype=ctype)
    assert r.status_code == 415 and r.json()["error"] == "unsupported_media_type"


def test_oversize_while_streaming(client, settings):
    r = post(client, form(), content=b"\x00" * (1024 * 1024 + 10))
    assert r.status_code == 413 and r.json()["error"] == "file_too_large"
    assert sessions(settings) == []


def test_oversize_by_content_length(client):
    r = post(client, form(), content=b"\x00" * (3 * 1024 * 1024))
    assert r.status_code == 413


def test_empty_and_unreadable(client, settings):
    assert post(client, form(), content=b"").json()["error"] == "empty_file"
    r = post(client, form(), content=b"definitely not a video")
    assert r.status_code == 422 and r.json()["error"] == "unreadable_video"
    assert sessions(settings) == []


def test_calibration_out_of_frame(client, video_bytes):
    r = post(client, form(calibration_points=json.dumps([[5, 40], [600, 40], [40, 5], [20, 5]])), content=video_bytes)
    assert r.status_code == 422 and r.json()["error"] == "calibration_out_of_frame"


def test_missing_weights_returns_503_and_cleans_up(client, settings, video_bytes):
    assert client.app.state.detectors is None
    r = post(client, form(), content=video_bytes)
    assert r.status_code == 503 and r.json()["error"] == "models_unavailable"
    assert sessions(settings) == []


def test_pipeline_receives_request_and_input_is_purged(client, settings, video_bytes, monkeypatch):
    seen = {}

    def fake_analyze(video_path, req, session_dir, detectors, pipeline_settings):
        seen.update(path=video_path, req=req, settings=pipeline_settings)
        assert video_path.read_bytes() == video_bytes
        (session_dir / "1_pre_contact.jpg").write_bytes(b"jpg")
        raise CapeError(422, "no_contact_detected", "No bat contact found")

    monkeypatch.setattr(pipeline, "analyze", fake_analyze)
    r = post(client, form(target="bowler", shot_type=None, bowler_type="pace"), content=video_bytes)
    assert r.status_code == 422 and r.json()["error"] == "no_contact_detected"
    assert seen["req"].bowler_type == "pace" and seen["path"].suffix == ".avi"
    assert seen["settings"] is settings
    assert seen["req"].pitch_points[2] == (1.525, 20.12)
    assert sessions(settings) == []


@pytest.fixture
def artifacts(settings):
    sid, path = workspace.create_session(settings)
    for name in ("1_pre_contact.jpg", "2_point_of_contact.jpg", "3_post_contact.jpg"):
        (path / name).write_bytes(name.encode())
    (path / "input.mp4").write_bytes(b"secret")
    return sid


def test_artifact_download(client, artifacts):
    r = client.get(f"/api/v1/artifacts/{artifacts}/2_point_of_contact.jpg")
    assert r.status_code == 200
    assert r.content == b"2_point_of_contact.jpg"
    assert r.headers["content-type"] == "image/jpeg"
    assert r.headers["content-disposition"].startswith("attachment")


def test_artifact_zip(client, artifacts):
    r = client.get(f"/api/v1/artifacts/{artifacts}/all.zip")
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    names = zipfile.ZipFile(io.BytesIO(r.content)).namelist()
    assert names == ["1_pre_contact.jpg", "2_point_of_contact.jpg", "3_post_contact.jpg"]
    assert client.get(f"/api/v1/artifacts/{artifacts}/all.zip").content == r.content


@pytest.mark.parametrize(
    "path",
    [
        "{sid}/1_release.jpg",
        "{sid}/input.mp4",
        "{sid}/..%2F..%2Fsecret.jpg",
        "not-a-uuid/1_pre_contact.jpg",
        "00000000-0000-4000-8000-000000000000/1_pre_contact.jpg",
    ],
)
def test_artifact_404(client, artifacts, path):
    r = client.get("/api/v1/artifacts/" + path.format(sid=artifacts))
    assert r.status_code == 404


def test_zip_404_when_no_artifacts(client, settings):
    sid, _ = workspace.create_session(settings)
    assert client.get(f"/api/v1/artifacts/{sid}/all.zip").status_code == 404


def test_routes_require_api_key(tmp_path, artifacts):
    with TestClient(create_app(Settings(workspace_dir=tmp_path / "ws", api_key="k"))) as c:
        assert c.get(f"/api/v1/artifacts/{artifacts}/1_pre_contact.jpg").status_code == 401
        r = c.get(f"/api/v1/artifacts/{artifacts}/1_pre_contact.jpg", headers={"X-API-Key": "k"})
        assert r.status_code == 200
