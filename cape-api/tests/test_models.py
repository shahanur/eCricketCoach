import sys
import types
from types import SimpleNamespace

import numpy as np
import pytest

import app.models as models
from app.config import Settings
from app.models import MissingWeightsError, load_detectors, resolve_device
from app.models.ball import YoloBallDetector
from app.models.bat import YoloBatSegmenter
from app.models.base import BallDetector, BatSegmenter, Box, LandmarkEstimator, PoseDetector
from app.models.landmarks import LANDMARK_NAMES, MediaPipeLandmarks, crop_roi, remap_landmarks
from app.models.pose import YoloPoseDetector

FRAME = np.zeros((100, 200, 3), np.uint8)


def test_heavy_libraries_not_imported():
    assert "ultralytics" not in sys.modules and "mediapipe" not in sys.modules


def test_box_center_and_area():
    b = Box(10, 20, 30, 60, 0.9, 0)
    assert b.center == (20, 40) and b.area == 800


# --- crop_roi -----------------------------------------------------------------


def test_crop_roi_padding():
    crop, (x0, y0) = crop_roi(FRAME, Box(50, 20, 90, 60, 1, 0), pad=0.25)
    assert (x0, y0) == (40, 10)
    assert crop.shape[:2] == (60, 60)  # 40×40 box grown by 10 px each side


def test_crop_roi_clamps_to_frame():
    crop, (x0, y0) = crop_roi(FRAME, Box(-10, -5, 30, 120, 1, 0), pad=0.15)
    assert (x0, y0) == (0, 0)
    assert crop.shape[:2] == (100, 36)  # x2 = 30 + 40*0.15 = 36; y clipped to 100


def test_crop_roi_zero_pad_is_exact_view():
    frame = np.arange(100 * 200 * 3, dtype=np.uint8).reshape(100, 200, 3)
    crop, _ = crop_roi(frame, Box(5, 6, 15, 26, 1, 0), pad=0)
    assert np.shares_memory(crop, frame) and np.array_equal(crop, frame[6:26, 5:15])


@pytest.mark.parametrize("box", [Box(300, 10, 400, 50, 1, 0), Box(10, -90, 50, -40, 1, 0), Box(50, 50, 50, 50, 1, 0)])
def test_crop_roi_outside_or_empty(box):
    assert crop_roi(FRAME, box, pad=0) is None


# --- landmark remapping -------------------------------------------------------


def lm(x, y, z=0.0, visibility=1.0):
    return SimpleNamespace(x=x, y=y, z=z, visibility=visibility)


def test_remap_landmarks_to_frame_pixels():
    raw = [lm(0.5, 0.25, -0.1)] + [lm(0, 0)] * 31 + [lm(1.0, 1.0, 0.2)]
    out = remap_landmarks(raw, offset=(40, 10), crop_size=(60, 80))
    assert len(LANDMARK_NAMES) == 33 and len(out.points) == 33
    assert out.points["nose"] == pytest.approx((70.0, 30.0, -6.0))
    assert out.points["right_foot_index"] == pytest.approx((100.0, 90.0, 12.0))
    assert out.points["left_eye_inner"] == pytest.approx((40.0, 10.0, 0.0))


def test_remap_landmarks_drops_low_visibility():
    raw = [lm(0.1, 0.1, visibility=0.9), lm(0.2, 0.2, visibility=0.2)]
    out = remap_landmarks(raw, (0, 0), (10, 10), min_visibility=0.5)
    assert set(out.points) == {"nose"}
    assert remap_landmarks([lm(0, 0, visibility=0.1)], (0, 0), (10, 10)) is None


# --- adapters with mocked libraries -------------------------------------------


class FakeYOLO:
    result = None
    calls: list = []

    def __init__(self, path):
        self.path = path

    def predict(self, frame, device, verbose):
        FakeYOLO.calls.append((self.path, device))
        return [FakeYOLO.result]


@pytest.fixture
def fake_ultralytics(monkeypatch):
    FakeYOLO.calls = []
    monkeypatch.setitem(sys.modules, "ultralytics", types.SimpleNamespace(YOLO=FakeYOLO))
    return FakeYOLO


class Boxes:
    def __init__(self, xyxy, conf, cls):
        self.xyxy, self.conf, self.cls = np.array(xyxy, float), np.array(conf, float), np.array(cls, float)

    def __len__(self):
        return len(self.xyxy)


def test_ball_detector_picks_highest_confidence(fake_ultralytics, tmp_path):
    fake_ultralytics.result = SimpleNamespace(
        boxes=Boxes([[0, 0, 4, 4], [10, 10, 20, 14], [5, 5, 6, 6], [1, 1, 2, 2]], [0.5, 0.8, 0.99, 0.1], [0, 1, 7, 0])
    )
    det = YoloBallDetector(tmp_path / "ball.pt", "cpu")
    box = det.detect(FRAME)
    assert box == Box(10, 10, 20, 14, pytest.approx(0.8), 1)
    det.detect(FRAME)
    assert fake_ultralytics.calls == [(str(tmp_path / "ball.pt"), "cpu")] * 2


def test_ball_detector_none(fake_ultralytics, tmp_path):
    fake_ultralytics.result = SimpleNamespace(boxes=Boxes(np.zeros((0, 4)), [], []))
    assert YoloBallDetector(tmp_path / "b.pt", "cpu").detect(FRAME) is None
    fake_ultralytics.result = SimpleNamespace(boxes=Boxes([[0, 0, 1, 1]], [0.1], [0]))
    assert YoloBallDetector(tmp_path / "b.pt", "cpu").detect(FRAME) is None


def test_ball_detector_coco_fallback_maps_sports_ball(fake_ultralytics, tmp_path):
    fake_ultralytics.result = SimpleNamespace(boxes=Boxes([[0, 0, 4, 4], [10, 10, 12, 12]], [0.9, 0.3], [0, 32]))
    box = YoloBallDetector(tmp_path / "b.pt", "cpu", min_conf=0.15, class_map={32: 0}).detect(FRAME)
    assert box == Box(10, 10, 12, 12, pytest.approx(0.3), 0)


def test_pose_detector(fake_ultralytics, tmp_path):
    kps = np.arange(2 * 17 * 2, dtype=float).reshape(2, 17, 2)
    fake_ultralytics.result = SimpleNamespace(
        boxes=Boxes([[0, 0, 10, 20], [30, 0, 50, 40]], [0.6, 0.9], [0, 0]), keypoints=SimpleNamespace(xy=kps)
    )
    out = YoloPoseDetector(tmp_path / "p.pt", "cpu").detect(FRAME)
    assert [p.box.x1 for p in out] == [30, 0]
    assert len(out[0].keypoints) == 17 and out[0].keypoints[0] == (34.0, 35.0)


def test_bat_segmenter_largest_polygon(fake_ultralytics, tmp_path):
    small = [[0, 0], [5, 0], [5, 5]]
    big = [[10, 10], [60, 10], [60, 40], [10, 40]]
    fake_ultralytics.result = SimpleNamespace(masks=SimpleNamespace(xy=[np.array(small), np.array(big), np.zeros((2, 2))]))
    poly = YoloBatSegmenter(tmp_path / "s.pt", "cpu").segment(FRAME)
    assert poly.shape == (4, 2) and poly.dtype == np.float32
    fake_ultralytics.result = SimpleNamespace(masks=None)
    assert YoloBatSegmenter(tmp_path / "s.pt", "cpu").segment(FRAME) is None


def test_bat_segmenter_class_filter(fake_ultralytics, tmp_path):
    person = [[0, 0], [90, 0], [90, 90], [0, 90]]
    bat = [[10, 10], [20, 10], [20, 40]]
    fake_ultralytics.result = SimpleNamespace(
        masks=SimpleNamespace(xy=[np.array(person), np.array(bat)]), boxes=Boxes(np.zeros((2, 4)), [0.9, 0.5], [0, 34])
    )
    poly = YoloBatSegmenter(tmp_path / "s.pt", "cpu", classes=frozenset({34})).segment(FRAME)
    assert poly.shape == (3, 2)
    fake_ultralytics.result.boxes = Boxes(np.zeros((2, 4)), [0.9, 0.5], [0, 0])
    assert YoloBatSegmenter(tmp_path / "s.pt", "cpu", classes=frozenset({34})).segment(FRAME) is None


def test_mediapipe_estimate_in_frame(monkeypatch):
    seen = {}

    class FakePose:
        def __init__(self, **kw):
            seen["kw"] = kw

        def process(self, rgb):
            seen["shape"] = rgb.shape
            return SimpleNamespace(pose_landmarks=SimpleNamespace(landmark=[lm(0.5, 0.5, 0.1)] * 33))

    mp = SimpleNamespace(solutions=SimpleNamespace(pose=SimpleNamespace(Pose=FakePose)))
    monkeypatch.setitem(sys.modules, "mediapipe", mp)
    est = MediaPipeLandmarks()
    out = est.estimate_in_frame(FRAME, Box(50, 20, 90, 60, 1, 0), pad=0.25)
    assert seen["shape"] == (60, 60, 3) and seen["kw"]["static_image_mode"] is True
    assert out.points["left_hip"] == pytest.approx((70.0, 40.0, 6.0))
    assert est.estimate(np.zeros((0, 0, 3), np.uint8)) is None


def test_adapters_satisfy_protocols(tmp_path):
    assert isinstance(YoloBallDetector(tmp_path, "cpu"), BallDetector)
    assert isinstance(YoloPoseDetector(tmp_path, "cpu"), PoseDetector)
    assert isinstance(YoloBatSegmenter(tmp_path, "cpu"), BatSegmenter)
    assert isinstance(MediaPipeLandmarks(), LandmarkEstimator)


# --- loading ------------------------------------------------------------------


def test_load_detectors_missing_weights(tmp_path):
    (tmp_path / "ball.pt").touch()
    with pytest.raises(MissingWeightsError, match="yolo11n-pose.pt"):
        load_detectors(Settings(weights_dir=tmp_path, device="cpu"))


def test_load_detectors_cached(tmp_path, monkeypatch):
    monkeypatch.setattr(models, "_cache", {})
    for f in models.WEIGHT_FILES.values():
        (tmp_path / f).touch()
    a = load_detectors(Settings(weights_dir=tmp_path, device="cpu"))
    assert a is load_detectors(Settings(weights_dir=tmp_path, device="cpu"))
    assert a.device == "cpu" and a.ball._yolo.device == "cpu"
    assert a.fallbacks == ()
    assert "ultralytics" not in sys.modules


def test_load_detectors_pretrained_fallback(tmp_path, monkeypatch):
    monkeypatch.setattr(models, "_cache", {})
    for f in ("yolo11n-pose.pt", *models.FALLBACK_WEIGHT_FILES.values()):
        (tmp_path / f).touch()
    d = load_detectors(Settings(weights_dir=tmp_path, device="cpu"))
    assert d.fallbacks == ("ball", "bat")
    assert d.ball._yolo.weights.name == "yolo11n.pt" and d.ball.class_map == {32: 0}
    assert d.bat._yolo.weights.name == "yolo11n-seg.pt" and d.bat.classes == frozenset({34})


def test_resolve_device_falls_back(monkeypatch):
    assert resolve_device("cpu") == "cpu"
    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(cuda=SimpleNamespace(is_available=lambda: False)))
    assert resolve_device("cuda") == "cpu"
    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(cuda=SimpleNamespace(is_available=lambda: True)))
    assert resolve_device("cuda") == "cuda"
    monkeypatch.setitem(sys.modules, "torch", None)  # ImportError
    assert resolve_device("cuda") == "cpu"
