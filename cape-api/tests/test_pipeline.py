import json
from types import SimpleNamespace

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import pipeline
from app.config import Settings
from app.main import create_app
from app.models.base import Box, Landmarks, PoseResult
from app.schemas import DEFAULT_PITCH_POINTS_M, AnalysisRequest, CapeError

W, H, FPS, N = 320, 240, 30, 60


def px(x, y, h=0.0):
    """Side-on synthetic camera: pitch metres (+ height) -> pixels."""
    return (20 + y * 14, 150 + x * 25 - h * 30)


CAL = [list(px(x, y)) for x, y in DEFAULT_PITCH_POINTS_M]


@pytest.fixture(scope="module")
def video(tmp_path_factory):
    path = tmp_path_factory.mktemp("vid") / "clip.avi"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), FPS, (W, H))
    for i in range(N):
        writer.write(np.full((H, W, 3), (i * 4) % 256, np.uint8))
    writer.release()
    return path


def box(cx, cy, r=3):
    return Box(cx - r, cy - r, cx + r, cy + r, 0.9, 0)


class Ball:
    def __init__(self, path):
        self.path, self.i = path, -1

    def detect(self, frame):
        self.i += 1
        p = self.path(self.i)
        return None if p is None else box(*p)


class Persons:
    def __init__(self, *boxes, moving=None):
        self.boxes, self.moving, self.calls = boxes, moving, 0

    def detect(self, frame):
        self.calls += 1
        out = [PoseResult(b, []) for b in self.boxes]
        if self.moving:
            x1, y1, x2, y2 = self.moving
            dx = 3 * self.calls
            out.append(PoseResult(Box(x1 + dx, y1, x2 + dx, y2, 0.9, 0), []))
        return out


class Marks:
    def __init__(self, pts):
        self.pts = {k: (*v, 0.0) for k, v in pts.items()}

    def estimate_in_frame(self, frame, b, pad=0.15):
        return Landmarks(dict(self.pts))


class Bat:
    def segment(self, frame):
        return np.array([[32, 130], [36, 130], [52, 180], [48, 180]], np.float32)


BATTER_LM = {
    "nose": (30, 70), "left_shoulder": (35, 95), "right_shoulder": (25, 95),
    "left_elbow": (40, 115), "right_elbow": (28, 117), "left_wrist": (35, 130), "right_wrist": (33, 131),
    "left_hip": (30, 180), "right_hip": (24, 180),
    "left_knee": (40, 195), "right_knee": (20, 200),  # front (left) knee collapsed to ~70°
    "left_ankle": (28, 198), "right_ankle": (16, 220),
}
BOWLER_LM = {
    "nose": (285, 70), "left_shoulder": (280, 85), "right_shoulder": (290, 85),
    "left_elbow": (275, 100), "right_elbow": (292, 60), "left_wrist": (272, 110), "right_wrist": (294, 40),
    "left_hip": (282, 115), "right_hip": (288, 115),
    "left_knee": (276, 132), "right_knee": (292, 132), "left_ankle": (274, 150), "right_ankle": (295, 150),
}


def batter_ball(contact=True):
    def path(i):
        if i <= 30:
            return px(0, 18 - (18 - 0.6) * i / 30, 1)
        u, v = px(0, 0.6, 1)
        k = i - 30
        return (u + 6 * k, v - 4 * k) if contact else (u - 8 * k, v)

    return path


def bowler_ball(bounce=True):
    def path(i):
        if i < 5:
            return None
        if i <= 20:
            t = (i - 5) / 15
            return px(-0.3, 18 - 11.5 * t, 2.2 * (1 - t))
        k = i - 20
        return px(-0.3, 6.5 - 0.7 * k, 0.1 * k if bounce else -0.1 * k)

    return path


def batter_detectors(contact=True):
    return SimpleNamespace(
        ball=Ball(batter_ball(contact)),
        pose=Persons(Box(10, 60, 50, 190, 0.9, 0), Box(200, 80, 230, 190, 0.9, 0)),
        bat=Bat(),
        landmarks=Marks(BATTER_LM),
    )


def bowler_detectors(bounce=True):
    return SimpleNamespace(
        ball=Ball(bowler_ball(bounce)),
        pose=Persons(Box(10, 60, 50, 150, 0.9, 0), moving=(262, 30, 302, 150)),
        bat=Bat(),
        landmarks=Marks(BOWLER_LM),
    )


def batter_req():
    return AnalysisRequest(target="batter", handedness="right", shot_type="front_foot_drive", calibration_points=CAL)


def bowler_req():
    return AnalysisRequest(target="bowler", handedness="right", bowler_type="pace", calibration_points=CAL)


def test_batter_pipeline(video, tmp_path):
    session = tmp_path / "s1"
    session.mkdir()
    res = pipeline.analyze(video, batter_req(), session, batter_detectors())
    a = res.analytics_payload
    assert a.point_of_contact.milestone_frame == 30
    assert a.pre_contact.milestone_frame == 26 and a.post_contact.milestone_frame == 36
    assert 65 < a.pre_contact.batter_joint_angles["front_knee"] < 75
    assert a.point_of_contact.bat_angle_degrees is not None and a.point_of_contact.batter_3d_landmarks
    assert a.point_of_contact.ball_velocity_kmh > 0 and a.post_contact.launch_angle_degrees > 0
    codes = [f.code for f in res.coaching.faults]
    assert "front_knee_collapsed" in codes and res.coaching.score < 100
    assert res.delivery is None and res.metadata.resolution == "320x240"
    assert sorted(p.name for p in session.iterdir()) == ["1_pre_contact.jpg", "2_point_of_contact.jpg", "3_post_contact.jpg"]
    assert res.download_endpoints.impact_snapshot.endswith("/s1/2_point_of_contact.jpg")


def test_bowler_pipeline(video, tmp_path):
    session = tmp_path / "s2"
    session.mkdir()
    res = pipeline.analyze(video, bowler_req(), session, bowler_detectors())
    d = res.delivery
    assert d.length_zone == "good_length" and d.line_zone == "off_stump_channel" and d.is_good_ball
    assert abs(d.length_m - 6.5) < 0.2 and d.speed_kmh > 0
    rel = res.analytics_payload.release
    assert rel.milestone_frame == 5 and rel.release_height_m > 1.5 and rel.bowler_joint_angles
    assert sorted(p.name for p in session.iterdir()) == ["1_release.jpg", "2_pitching_point.jpg", "3_pitch_map.jpg"]
    assert res.coaching.verdict


@pytest.mark.parametrize(
    "req,det,code",
    [
        (batter_req, lambda: batter_detectors(contact=False), "no_contact_detected"),
        (bowler_req, lambda: bowler_detectors(bounce=False), "no_pitching_point_detected"),
    ],
)
def test_missing_milestones(video, tmp_path, req, det, code):
    with pytest.raises(CapeError) as e:
        pipeline.analyze(video, req(), tmp_path, det())
    assert e.value.status_code == 422 and e.value.code == code


def test_models_unavailable(video, tmp_path):
    with pytest.raises(CapeError) as e:
        pipeline.analyze(video, batter_req(), tmp_path, None)
    assert e.value.status_code == 503 and e.value.code == "models_unavailable"


def test_unreadable_video(tmp_path):
    bad = tmp_path / "x.avi"
    bad.write_bytes(b"nope")
    with pytest.raises(CapeError) as e:
        pipeline.analyze(bad, batter_req(), tmp_path, batter_detectors())
    assert e.value.code == "unreadable_video"


def test_api_end_to_end(video, tmp_path):
    settings = Settings(workspace_dir=tmp_path / "ws", weights_dir=tmp_path / "none")
    with TestClient(create_app(settings)) as client:
        client.app.state.detectors = batter_detectors()
        data = {
            "target": "batter", "handedness": "right", "shot_type": "front_foot_drive",
            "calibration_points": json.dumps(CAL),
        }
        r = client.post(
            "/api/v1/analyze-cricket-video",
            data=data,
            files={"file": ("clip.avi", video.read_bytes(), "video/x-msvideo")},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "success" and body["coaching"]["faults"]
        img = client.get(body["download_endpoints"]["impact_snapshot"])
        assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg"
