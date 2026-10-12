import pytest

from training.split_dataset import group_key, plan_split, split_dataset


def make_raw(root, videos):
    (root / "images").mkdir(parents=True)
    (root / "labels").mkdir()
    for video, n in videos.items():
        for i in range(n):
            (root / "images" / f"{video}_{i:06d}.jpg").write_bytes(b"img")
            if i % 2 == 0:
                (root / "labels" / f"{video}_{i:06d}.txt").write_text("0 0.5 0.5 0.01 0.01\n")


VIDEOS = {f"clip{v:02d}": 10 for v in range(20)}


@pytest.mark.parametrize(
    "stem,key",
    [("nets03_000412", "nets03"), ("match_day_2-15", "match_day_2"), ("clip_frame12", "clip"), ("single", "single")],
)
def test_group_key(stem, key):
    assert group_key(stem) == key


def test_split_counts_groups_and_determinism(tmp_path):
    raw = tmp_path / "raw"
    make_raw(raw, VIDEOS)
    counts = split_dataset(raw, tmp_path / "out", seed=7)
    assert counts == {"train": 160, "val": 20, "test": 20}

    groups = {}
    for split in counts:
        imgs = list((tmp_path / "out" / split / "images").iterdir())
        assert len(imgs) == counts[split]
        groups[split] = {group_key(p.stem) for p in imgs}
        labels = list((tmp_path / "out" / split / "labels").iterdir())
        assert len(labels) == counts[split] // 2
    assert not (groups["train"] & groups["val"]) and not (groups["train"] & groups["test"])
    assert not (groups["val"] & groups["test"])

    images = list((raw / "images").iterdir())
    assert plan_split(images, seed=7) == plan_split(list(reversed(images)), seed=7)
    assert plan_split(images, seed=7) != plan_split(images, seed=8)
    assert (raw / "images" / "clip00_000000.jpg").exists()  # copy, not move


def test_split_uneven_groups_and_move(tmp_path):
    raw = tmp_path / "raw"
    make_raw(raw, {"big": 50, "a": 6, "b": 5, "c": 5, "d": 4})
    counts = split_dataset(raw, tmp_path / "out", move=True)
    assert sum(counts.values()) == 70 and counts["train"] >= 50 and counts["val"] and counts["test"]
    assert not any((raw / "images").iterdir())


def test_split_errors(tmp_path):
    (tmp_path / "images").mkdir()
    with pytest.raises(FileNotFoundError):
        split_dataset(tmp_path, tmp_path / "out")
    with pytest.raises(ValueError):
        plan_split([tmp_path / "x_1.jpg"], ratios=(0, 0, 0))
