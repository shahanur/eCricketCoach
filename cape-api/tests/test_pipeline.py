import json
import math
from types import SimpleNamespace

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import pipeline
from app.config import Settings
from app.gemini_contact import ContactSelection
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


def test_gemini_contact_frame_overrides_detector_milestone(video, tmp_path, monkeypatch):
    monkeypatch.setattr(
        pipeline,
        "select_contact_frame",
        lambda *_: ContactSelection(25, 0.91, (0.2, 0.6), "visible impact"),
    )
    settings = Settings(gemini_api_key="test-key")
    session = tmp_path / "gemini"
    session.mkdir()
    res = pipeline.analyze(video, batter_req(), session, batter_detectors(), settings)
    contact = res.analytics_payload.point_of_contact
    assert contact.milestone_frame == 25
    assert contact.selection_source == "gemini"
    assert contact.selection_confidence == 0.91
    assert res.analytics_payload.pre_contact.milestone_frame == 21
    assert res.analytics_payload.post_contact.milestone_frame == 31
    assert res.analytics_payload.post_contact.batter_joint_angles


def manual_req(pre, contact, post):
    return AnalysisRequest(
        target="batter", handedness="right", shot_type="front_foot_drive", calibration_points=CAL,
        manual_frames={"pre_contact": pre, "point_of_contact": contact, "post_contact": post},
    )


def test_manual_frames_override_gemini_and_detector(video, tmp_path, monkeypatch):
    def fail(*_):
        raise AssertionError("Gemini must not be called when manual frames are given")

    monkeypatch.setattr(pipeline, "select_contact_frame", fail)
    session = tmp_path / "manual"
    session.mkdir()
    res = pipeline.analyze(video, manual_req(10, 22, 40), session, batter_detectors(), Settings(gemini_api_key="k"))
    a = res.analytics_payload
    assert (a.pre_contact.milestone_frame, a.point_of_contact.milestone_frame, a.post_contact.milestone_frame) == (10, 22, 40)
    assert a.point_of_contact.selection_source == "manual"
    assert a.point_of_contact.candidate_frames == [22]
    assert sorted(p.name for p in session.iterdir()) == ["1_pre_contact.jpg", "2_point_of_contact.jpg", "3_post_contact.jpg"]


HANDS = (34.0, 130.0)


def frame_index(frame):
    return int(round(float(frame.mean()) / 4))


class SwingingBat:
    """Bat from the hands at 3 degrees per frame, so the swing arc is predictable."""

    def segment(self, frame):
        theta = np.radians(3 * frame_index(frame))
        d, n = np.array([np.cos(theta), np.sin(theta)]), np.array([-np.sin(theta), np.cos(theta)])
        hands, tip = np.array(HANDS), np.array(HANDS) + 50 * d
        return np.array([hands + 2 * n, tip + 2 * n, tip - 2 * n, hands - 2 * n], np.float32)


class PersonsWithWrists(Persons):
    def detect(self, frame):
        kps = [(0.0, 0.0)] * 17
        kps[9], kps[10] = (HANDS[0] - 1, HANDS[1]), (HANDS[0] + 1, HANDS[1])
        return [PoseResult(self.boxes[0], kps), *(PoseResult(b, []) for b in self.boxes[1:])]


def swing_detectors():
    return SimpleNamespace(
        ball=Ball(batter_ball()),
        pose=PersonsWithWrists(Box(10, 60, 50, 190, 0.9, 0), Box(200, 80, 230, 190, 0.9, 0)),
        bat=SwingingBat(),
        landmarks=Marks(BATTER_LM),
    )


def test_manual_multi_frames_pick_best_contact_and_trace_swing(video, tmp_path):
    session = tmp_path / "manual_multi"
    session.mkdir()
    req = manual_req([18, 10, 14], [22, 30, 26], [34, 40, 46])
    res = pipeline.analyze(video, req, session, swing_detectors())
    a = res.analytics_payload
    # Frame 30 has the ball touching the bat; 22 and 26 have it further away.
    assert a.point_of_contact.milestone_frame == 30
    assert a.point_of_contact.candidate_frames == [22, 26, 30]
    assert a.pre_contact.milestone_frame == 10 and a.post_contact.milestone_frame == 46
    assert a.pre_contact.swing_frames == [10, 14, 18, 30]
    assert a.post_contact.follow_through_frames == [30, 34, 40, 46]
    assert a.pre_contact.bat_swing_arc_degrees == pytest.approx(60, abs=1)
    assert a.post_contact.follow_through_arc_degrees == pytest.approx(48, abs=1)
    assert not a.pre_contact.bat_swing_estimated
    assert sorted(p.name for p in session.iterdir()) == ["1_pre_contact.jpg", "2_point_of_contact.jpg", "3_post_contact.jpg"]


def test_manual_contact_without_ball_uses_middle_candidate_and_sweet_spot(video, tmp_path):
    session = tmp_path / "manual_middle"
    session.mkdir()
    det = swing_detectors()
    det.ball = Ball(lambda i: None)
    res = pipeline.analyze(video, manual_req([5], [20, 24, 28], [40]), session, det)
    a = res.analytics_payload
    assert a.point_of_contact.milestone_frame == 24
    assert a.pre_contact.bat_swing_arc_degrees == pytest.approx(57, abs=1)


def test_manual_contact_without_any_evidence_is_rejected(video, tmp_path):
    det = batter_detectors()
    det.ball = Ball(lambda i: None)
    with pytest.raises(CapeError) as e:
        pipeline.analyze(video, manual_req([5], [20, 24, 28], [40]), tmp_path, det)
    assert e.value.code == "no_contact_point_detected"


def test_manual_swing_falls_back_to_forearms_without_bat(video, tmp_path):
    class ForearmPersons(Persons):
        def detect(self, frame):
            theta = np.radians(3 * frame_index(frame))
            d = np.array([np.cos(theta), np.sin(theta)])
            kps = [(0.0, 0.0)] * 17
            elbow = tuple(np.array(HANDS) - 15 * d)
            kps[7] = kps[8] = elbow
            kps[9] = kps[10] = HANDS
            return [PoseResult(self.boxes[0], kps)]

    class NoBat:
        def segment(self, frame):
            return None

    det = swing_detectors()
    det.pose = ForearmPersons(Box(10, 60, 50, 190, 0.9, 0))
    det.bat = NoBat()
    session = tmp_path / "forearm"
    session.mkdir()
    a = pipeline.analyze(video, manual_req([10, 20], [30], [40, 50]), session, det).analytics_payload
    assert a.pre_contact.bat_swing_arc_degrees == pytest.approx(60, abs=1)
    assert a.pre_contact.bat_swing_estimated and a.post_contact.follow_through_estimated


def test_swing_arc_deg():
    h = (0.0, 0.0)
    assert pipeline.swing_arc_deg([(h, (10.0, 0.0)), (h, (0.0, 10.0)), (h, (-10.0, 0.0))]) == pytest.approx(180)
    # Wraps across ±180 without jumping a full turn.
    assert pipeline.swing_arc_deg([(h, (-10.0, 1.0)), (h, (-10.0, -1.0))]) == pytest.approx(11.4, abs=0.1)
    assert pipeline.swing_arc_deg([(h, (10.0, 0.0)), (None, None)]) is None


def test_manual_contact_only_scans_swing_and_follow_through(video, tmp_path):
    session = tmp_path / "contact_only"
    session.mkdir()
    req = AnalysisRequest(
        target="batter", handedness="right", shot_type="front_foot_drive", calibration_points=CAL,
        manual_frames={"point_of_contact": [30]},
    )
    a = pipeline.analyze(video, req, session, swing_detectors()).analytics_payload
    # Bat angle = 3°/frame below the hands: the tip is highest at frame 0 before and frame 59 after contact.
    assert a.pre_contact.swing_frames_auto and a.post_contact.follow_through_frames_auto
    assert a.pre_contact.milestone_frame == 0 and a.post_contact.milestone_frame == N - 1
    assert a.pre_contact.swing_frames == list(range(31))
    assert a.post_contact.follow_through_frames == list(range(30, N))
    assert a.pre_contact.bat_swing_arc_degrees == pytest.approx(90, abs=1)
    assert a.post_contact.follow_through_arc_degrees == pytest.approx(87, abs=1)
    # 50 px bat = 0.8 m; tip moves 50 * rad(3°) px per frame at 30 fps.
    expected = 50 * math.radians(3) * FPS * (pipeline.BAT_HANDS_TO_TIP_M / 50) * 3.6
    assert a.pre_contact.bat_swing_speed_kmh == pytest.approx(expected, abs=0.1)
    assert sorted(p.name for p in session.iterdir()) == ["1_pre_contact.jpg", "2_point_of_contact.jpg", "3_post_contact.jpg"]


def test_manual_short_swing_reports_pre_and_post_contact_faults(video, tmp_path):
    session = tmp_path / "short_swing"
    session.mkdir()
    res = pipeline.analyze(video, manual_req([26, 28], [30], [32]), session, swing_detectors())
    a = res.analytics_payload
    assert not a.pre_contact.swing_frames_auto and a.pre_contact.swing_frames == [26, 28, 30]
    faults = {f.code: f.milestone for f in res.coaching.faults}
    assert faults["short_backswing"] == "pre_contact"
    assert faults["checked_follow_through"] == "post_contact"


def test_auto_window_and_bat_speed_helpers():
    assert pipeline.auto_window(-5, 3, keep_end=True) == [0, 1, 2, 3]
    pre = pipeline.auto_window(0, 59, keep_end=True)
    assert len(pre) == pipeline.AUTO_WINDOW_MAX_FRAMES and pre[-1] == 59
    post = pipeline.auto_window(61, 120, keep_end=False)
    assert len(post) == pipeline.AUTO_WINDOW_MAX_FRAMES and post[0] == 61
    assert pipeline.auto_window(5, 4, keep_end=False) == []
    h = (0.0, 0.0)
    # Straight 10 px/frame tip motion on a 100 px (0.8 m) bat at 30 fps -> 2.4 m/s.
    samples = [(f, (0.0, 10.0 * f), (100.0, 10.0 * f)) for f in range(10)]
    assert pipeline.bat_swing_speed_kmh(samples, 9, 30) == pytest.approx(10 * 30 * 0.8 / 100 * 3.6, rel=0.01)
    assert pipeline.bat_swing_speed_kmh([(9, h, (100.0, 0.0))], 9, 30) is None
    assert pipeline.bat_swing_speed_kmh([(f, h, None) for f in range(10)], 9, 30) is None


def test_swing_arc_points_follow_the_bat():
    from app import render

    h = (100.0, 100.0)
    pts = render.swing_arc_points([(h, (150.0, 100.0)), (h, (100.0, 150.0)), (h, (50.0, 100.0))])
    assert pts[0] == pytest.approx((150, 100)) and pts[-1] == pytest.approx((50, 100))
    assert all(math.dist(p, h) == pytest.approx(50) for p in pts)
    assert render.swing_arc_points([(h, (150.0, 100.0)), (None, None)]) is None
    frame = np.zeros((200, 200, 3), np.uint8)
    out = render.draw_swing_path(frame, [(h, (150.0, 100.0)), (h, (100.0, 150.0))], label="Bat swing")
    assert out.shape == frame.shape and out.any()


def test_manual_frames_beyond_clip_are_rejected(video, tmp_path):
    session = tmp_path / "manual_oob"
    session.mkdir()
    with pytest.raises(CapeError) as e:
        pipeline.analyze(video, manual_req(10, 20, N + 5), session, batter_detectors())
    assert e.value.status_code == 422 and e.value.code == "manual_frames_out_of_range"


def test_contact_candidates_window(video, monkeypatch):
    from app import candidates

    monkeypatch.setattr(candidates, "select_contact_frame", lambda *_: ContactSelection(30, 0.8, None, "impact"))
    out = candidates.contact_candidates(video, Settings(gemini_api_key="k"), None, before=3, after=2)
    assert out.suggested_frame == 30 and out.suggestion_source == "gemini"
    assert [f.index for f in out.frames] == [27, 28, 29, 30, 31, 32]
    assert out.frames[0].image_base64 and out.framerate_fps == FPS

    panned = candidates.contact_candidates(video, Settings(gemini_api_key="k"), None, center_frame=58, before=2, after=5)
    assert panned.suggested_frame is None and [f.index for f in panned.frames] == [56, 57, 58, 59]


def test_contact_candidates_without_gemini_uses_middle(video):
    from app import candidates

    out = candidates.contact_candidates(video, Settings(gemini_contact=False), None, before=1, after=1)
    assert out.suggested_frame is None and out.suggestion_note
    assert [f.index for f in out.frames] == [N // 2 - 1, N // 2, N // 2 + 1]


def test_contact_candidates_route(video, tmp_path):
    settings = Settings(workspace_dir=tmp_path / "ws", weights_dir=tmp_path / "none", gemini_contact=False)
    with TestClient(create_app(settings)) as client:
        r = client.post(
            "/api/v1/contact-candidates",
            files={"file": ("clip.avi", video.read_bytes(), "video/x-msvideo")},
            data={"center_frame": "5", "before": "2", "after": "2"},
        )
        assert r.status_code == 200, r.text
        assert [f["index"] for f in r.json()["frames"]] == [3, 4, 5, 6, 7]
        assert not any((tmp_path / "ws").iterdir())

        client.app.state.detectors = batter_detectors()
        r = client.post(
            "/api/v1/analyze-cricket-video",
            data={
                "target": "batter", "handedness": "right", "shot_type": "front_foot_drive",
                "calibration_points": json.dumps(CAL),
                "manual_frames": json.dumps({"pre_contact": [8, 10], "point_of_contact": [20, 22], "post_contact": [40, 44]}),
            },
            files={"file": ("clip.avi", video.read_bytes(), "video/x-msvideo")},
        )
        assert r.status_code == 200, r.text
        assert r.json()["analytics_payload"]["point_of_contact"]["selection_source"] == "manual"

        r = client.post(
            "/api/v1/analyze-cricket-video",
            data={
                "target": "batter", "handedness": "right", "shot_type": "front_foot_drive",
                "calibration_points": json.dumps(CAL),
                "manual_frames": json.dumps({"pre_contact": 30, "point_of_contact": 22, "post_contact": 40}),
            },
            files={"file": ("clip.avi", video.read_bytes(), "video/x-msvideo")},
        )
        assert r.status_code == 422


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


def test_swing_arc_ignores_flipped_bat_glitches():
    h = (0.0, 0.0)
    clean = [(h, (10 * math.cos(math.radians(a)), 10 * math.sin(math.radians(a)))) for a in range(0, 100, 10)]
    glitchy = clean[:5] + [(h, (-c[1][0], -c[1][1])) for c in clean[5:6]] + clean[6:]
    assert pipeline.swing_arc_deg(glitchy) == pytest.approx(90)
    spin = [(h, (10 * math.cos(math.radians(a)), 10 * math.sin(math.radians(a)))) for a in range(0, 500, 60)]
    assert pipeline.swing_arc_deg(spin) is None
