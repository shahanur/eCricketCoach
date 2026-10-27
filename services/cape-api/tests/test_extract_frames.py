import csv

import pytest

from training.extract_frames import (
    append_manifest,
    extract_video,
    frame_name,
    read_contacts,
    safe_stem,
    select_frames,
)
from training.split_dataset import group_key


@pytest.mark.parametrize(
    "name,stem",
    [
        ("WhatsApp Video 2026-10-12 at 17.15.51.mp4", "whatsapp-video-2026-10-12-at-17-15-51"),
        ("20250201_084044(1).mp4", "20250201-084044-1"),
        ("nets_03.MOV", "nets-03"),
        ("___.mp4", "video"),
    ],
)
def test_safe_stem_round_trips_through_split_grouping(name, stem):
    assert safe_stem(name) == stem
    assert group_key(frame_name(stem, 127).removesuffix(".jpg")) == stem


def test_select_frames_sparse_and_dense():
    frames, dense = select_frames(100, 30.0, every=10, around_ms=[1000], window_ms=100)
    assert dense == set(range(27, 34))  # 1000 ms = frame 30, ±3 frames
    assert set(range(0, 100, 10)) <= set(frames)
    assert frames == sorted(set(frames))


def test_select_frames_clamps_and_caps():
    frames, dense = select_frames(20, 30.0, every=1, around_ms=[0, 10_000], window_ms=100, max_sparse=4)
    assert dense == {0, 1, 2, 3}
    assert len(set(frames) - dense) <= 4
    assert select_frames(0, 30.0) == ([], set())
    with pytest.raises(ValueError):
        select_frames(10, 0)


def test_read_contacts_matches_by_stem(tmp_path):
    path = tmp_path / "contacts.csv"
    path.write_text("video,ms\nNets 03.mp4,4250\nnets 03.mp4,9000\nother.mov,abc\n", encoding="utf-8")
    assert read_contacts(path) == {"nets-03": [4250.0, 9000.0]}


def test_extract_video_writes_frames_and_manifest(tmp_path):
    cv2 = pytest.importorskip("cv2")
    np = pytest.importorskip("numpy")
    clip = tmp_path / "Net Clip.avi"
    writer = cv2.VideoWriter(str(clip), cv2.VideoWriter_fourcc(*"MJPG"), 10.0, (64, 48))
    for i in range(30):
        frame = np.zeros((48, 64, 3), np.uint8)
        if i >= 15:
            frame[:] = 200  # scene change half way through
        writer.write(frame)
    writer.release()

    out = tmp_path / "raw"
    rows = extract_video(clip, out, every=5, around_ms=[2000], window_ms=100, min_change=5.0)
    frames = [r["frame"] for r in rows]
    # Static sparse frames collapse to the first one per scene; dense frames 19–21 are always kept.
    assert {0, 19, 20, 21} <= set(frames)
    assert 5 not in frames and 10 not in frames
    assert all((out / "images" / r["image"]).exists() for r in rows)
    assert next(r for r in rows if r["frame"] == 20)["ms"] == 2000

    append_manifest(out, rows)
    append_manifest(out, rows[:1])
    with open(out / "manifest.csv", newline="", encoding="utf-8") as fh:
        assert len(list(csv.DictReader(fh))) == len(rows) + 1
