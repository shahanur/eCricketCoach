import pytest
import yaml

from training.train_bat import DATASET_YAML, check_seg_labels, dataset_config, validate_dataset

POLY = "0 0.40 0.20 0.45 0.20 0.50 0.70 0.45 0.72\n"


def make_split(root, labels):
    (root / "images").mkdir(parents=True)
    (root / "labels").mkdir()
    for i, text in enumerate(labels):
        (root / "images" / f"clip_{i:06d}.jpg").write_bytes(b"img")
        if text is not None:
            (root / "labels" / f"clip_{i:06d}.txt").write_text(text)


def make_dataset(root, train_labels):
    make_split(root / "train", train_labels)
    make_split(root / "val", [POLY])
    make_split(root / "test", [None])


def test_bat_yaml_is_single_class():
    assert yaml.safe_load(DATASET_YAML.read_text(encoding="utf-8"))["names"] == {0: "cricket_bat"}


def test_check_seg_labels_counts_polygons_and_backgrounds(tmp_path):
    make_split(tmp_path, [POLY, POLY + POLY, "", None])
    r = check_seg_labels(tmp_path)
    assert (r.images, r.with_bat, r.polygons, r.errors) == (4, 2, 3, [])


@pytest.mark.parametrize(
    "line,message",
    [
        ("0 0.5 0.5 0.1 0.3", "looks like a box"),
        ("1 0.1 0.1 0.2 0.2 0.3 0.1", "class 1"),
        ("0 0.1 0.1 0.2 0.2", "looks like a box"),
        ("0 0.1 0.1 0.2 0.2 0.3", "polygon needs"),
        ("0 10 10 20 20 30 10", "normalised"),
        ("0 a b c d e f", "not numbers"),
    ],
)
def test_check_seg_labels_rejects_bad_lines(tmp_path, line, message):
    make_split(tmp_path, [line + "\n"])
    errors = check_seg_labels(tmp_path).errors
    assert len(errors) == 1 and message in errors[0]


def test_validate_dataset(tmp_path):
    make_dataset(tmp_path / "ok", [POLY, None])
    assert validate_dataset(tmp_path / "ok")["train"].with_bat == 1

    make_dataset(tmp_path / "boxes", ["0 0.5 0.5 0.1 0.3\n"])
    with pytest.raises(ValueError, match="looks like a box"):
        validate_dataset(tmp_path / "boxes")

    make_dataset(tmp_path / "empty", [None])
    with pytest.raises(ValueError, match="no bat polygons"):
        validate_dataset(tmp_path / "empty")


def test_dataset_config_resolves_path(tmp_path):
    make_dataset(tmp_path, [POLY])
    cfg = yaml.safe_load(dataset_config(tmp_path).read_text(encoding="utf-8"))
    assert cfg["path"] == str(tmp_path.resolve()) and cfg["names"] == {0: "cricket_bat"}
    with pytest.raises(FileNotFoundError):
        dataset_config(tmp_path / "missing")
