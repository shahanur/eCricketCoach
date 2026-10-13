import pytest

from training.labelstudio_to_yolo import class_ids, convert, image_stem, region_line
from training.train_bat import DATASET_YAML as BAT_YAML
from training.train_bat import check_seg_labels
from training.train_ball import DATASET_YAML as BALL_YAML

BAT = class_ids(BAT_YAML)
BALL = class_ids(BALL_YAML)


def polygon(points, label="cricket_bat"):
    return {"type": "polygonlabels", "value": {"points": points, "polygonlabels": [label]}}


def task(name, result=None, cancelled=False):
    t = {"data": {"image": f"/data/local-files/?d=raw_bat/images/{name}.jpg"}, "annotations": []}
    if result is not None:
        t["annotations"].append({"id": 1, "result": result, "was_cancelled": cancelled})
    return t


def test_class_ids_from_dataset_yaml():
    assert BAT == {"cricket_bat": 0}
    assert BALL == {"cricket_ball": 0, "blurred_ball": 1}


@pytest.mark.parametrize(
    "ref,stem",
    [
        ("/data/local-files/?d=raw_bat/images/clip-1_000029.jpg", "clip-1_000029"),
        ("/data/local-files/?d=raw_bat%2Fimages%2Fclip_000001.jpg", "clip_000001"),
        ("/data/upload/1/clip_000002.jpg", "clip_000002"),
    ],
)
def test_image_stem(ref, stem):
    assert image_stem(ref) == stem


def test_region_lines():
    assert region_line(polygon([[10, 20], [20, 20], [15, 80]]), BAT) == (
        "0 0.100000 0.200000 0.200000 0.200000 0.150000 0.800000")
    box = {"type": "rectanglelabels",
           "value": {"x": 40, "y": 50, "width": 10, "height": 4, "rectanglelabels": ["blurred_ball"]}}
    assert region_line(box, BALL) == "1 0.450000 0.520000 0.100000 0.040000"
    assert region_line(polygon([[10, 20], [20, 20]]), BAT) is None
    with pytest.raises(ValueError, match="not in the dataset classes"):
        region_line(polygon([[1, 1], [2, 2], [3, 1]], "stumps"), BAT)


def test_convert_writes_yolo_seg_labels(tmp_path):
    tasks = [
        task("a_000001", [polygon([[10, 20], [20, 20], [15, 80]])]),
        task("a_000002", []),  # submitted with no bat = background
    ]
    counts = convert(tasks, tmp_path / "labels", BAT)
    assert counts == {"labelled": 2, "background": 1, "objects": 1, "skipped": 0}
    assert (tmp_path / "labels" / "a_000002.txt").read_text() == ""
    (tmp_path / "images").mkdir()
    for name in ("a_000001", "a_000002"):
        (tmp_path / "images" / f"{name}.jpg").write_bytes(b"img")
    report = check_seg_labels(tmp_path)
    assert (report.with_bat, report.errors) == (1, [])


def test_convert_refuses_unfinished_tasks(tmp_path):
    tasks = [task("a_000001", [polygon([[1, 1], [2, 2], [3, 1]])]), task("a_000002"), task("a_000003", [], True)]
    with pytest.raises(ValueError, match="2 task"):
        convert(tasks, tmp_path, BAT)
    assert convert(tasks, tmp_path, BAT, allow_unlabelled=True)["skipped"] == 2
    assert not (tmp_path / "a_000002.txt").exists()
