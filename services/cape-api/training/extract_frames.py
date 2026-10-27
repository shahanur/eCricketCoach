"""Extract frames from cricket clips for bat/ball labelling (spec §10.1).

Writes <out>/images/<video>_<frame>.jpg (the naming split_dataset.py groups on) and appends one row per
frame to <out>/manifest.csv. Two modes can be combined:

* sparse: every Nth frame across the clip (--every), optionally skipping near-identical frames (--min-change);
* dense:  every frame within ±--window-ms of a known bat-ball contact (--around, or --contacts for many clips).
  Dense frames are always kept: they hold the blurred ball and bat at contact, which the models need most.
"""

from __future__ import annotations

import argparse
import csv
import math
import re
from collections.abc import Iterable, Sequence
from pathlib import Path

VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm", ".3gp"}
MANIFEST_FIELDS = ("image", "video", "frame", "ms", "dense")


def safe_stem(name: str) -> str:
    """Lower-case, dash-separated video name, so `_` only ever separates the frame number."""
    stem = re.sub(r"[^a-z0-9]+", "-", Path(name).stem.lower()).strip("-")
    return stem or "video"


def frame_name(stem: str, index: int) -> str:
    return f"{stem}_{index:06d}.jpg"


def select_frames(
    frame_count: int,
    fps: float,
    every: int = 5,
    around_ms: Sequence[float] = (),
    window_ms: float = 300,
    max_sparse: int | None = None,
) -> tuple[list[int], set[int]]:
    """Return (sorted frame indices, the dense subset around contacts)."""
    if frame_count <= 0:
        return [], set()
    if fps <= 0:
        raise ValueError("fps must be positive")
    sparse = list(range(0, frame_count, every)) if every > 0 else []
    if max_sparse is not None and len(sparse) > max_sparse:
        step = len(sparse) / max(1, max_sparse)
        sparse = [sparse[int(i * step)] for i in range(max_sparse)]
    dense: set[int] = set()
    half = math.ceil(window_ms * fps / 1000)
    for ms in around_ms:
        centre = round(ms * fps / 1000)
        dense.update(range(max(0, centre - half), min(frame_count, centre + half + 1)))
    return sorted(set(sparse) | dense), dense


def mean_change(previous, current) -> float:
    """Mean absolute grey-level difference (0–255) between two frames, on a 160 px wide thumbnail."""
    import cv2

    def thumb(frame):
        h, w = frame.shape[:2]
        small = cv2.resize(frame, (160, max(1, round(160 * h / w))), interpolation=cv2.INTER_AREA)
        return cv2.cvtColor(small, cv2.COLOR_BGR2GRAY) if small.ndim == 3 else small

    return float(cv2.absdiff(thumb(previous), thumb(current)).mean())


def _open(path: Path):
    import cv2

    cap = cv2.VideoCapture(str(path))
    if hasattr(cv2, "CAP_PROP_ORIENTATION_AUTO"):
        cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)  # phone clips: honour the rotation tag so frames are upright
    if not cap.isOpened():
        raise ValueError(f"cannot open video {path}")
    return cap


def _count_frames(path: Path) -> int:
    cap = _open(path)
    try:
        count = 0
        while cap.grab():
            count += 1
        return count
    finally:
        cap.release()


def extract_video(
    path: Path,
    out: Path,
    every: int = 5,
    around_ms: Sequence[float] = (),
    window_ms: float = 300,
    max_sparse: int | None = None,
    min_change: float = 0.0,
    quality: int = 95,
    overwrite: bool = False,
) -> list[dict[str, object]]:
    """Save the selected frames of one clip; return their manifest rows."""
    import cv2

    path, out = Path(path), Path(out)
    images = out / "images"
    images.mkdir(parents=True, exist_ok=True)
    cap = _open(path)
    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    finally:
        cap.release()
    if count <= 0:
        count = _count_frames(path)  # some containers don't report a frame count
    wanted, dense = select_frames(count, fps, every, around_ms, window_ms, max_sparse)
    if not wanted:
        return []

    stem, rows, todo = safe_stem(path.name), [], set(wanted)
    last_saved = None
    cap = _open(path)
    try:
        index = 0
        while todo and index <= wanted[-1]:
            if index not in todo:
                if not cap.grab():
                    break
                index += 1
                continue
            ok, frame = cap.read()
            if not ok:
                break
            todo.discard(index)
            is_dense = index in dense
            if is_dense or last_saved is None or min_change <= 0 or mean_change(last_saved, frame) >= min_change:
                name = frame_name(stem, index)
                target = images / name
                if overwrite or not target.exists():
                    cv2.imwrite(str(target), frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
                rows.append({"image": name, "video": path.name, "frame": index,
                             "ms": round(index * 1000 / fps), "dense": int(is_dense)})
                last_saved = frame
            index += 1
    finally:
        cap.release()
    return rows


def find_videos(inputs: Iterable[Path]) -> list[Path]:
    videos: list[Path] = []
    for item in map(Path, inputs):
        if item.is_dir():
            videos.extend(sorted(p for p in item.rglob("*") if p.suffix.lower() in VIDEO_EXTS))
        elif item.suffix.lower() in VIDEO_EXTS:
            videos.append(item)
        else:
            raise ValueError(f"not a video or folder: {item}")
    return videos


def read_contacts(path: Path) -> dict[str, list[float]]:
    """CSV with `video,ms` rows (header optional); the video column matches the file name or its stem."""
    contacts: dict[str, list[float]] = {}
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.reader(fh):
            if len(row) < 2 or not row[0].strip():
                continue
            try:
                ms = float(row[1])
            except ValueError:
                continue  # header
            contacts.setdefault(safe_stem(row[0].strip()), []).append(ms)
    return contacts


def append_manifest(out: Path, rows: list[dict[str, object]]) -> None:
    manifest = Path(out) / "manifest.csv"
    new = not manifest.exists()
    with open(manifest, "a", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=MANIFEST_FIELDS)
        if new:
            writer.writeheader()
        writer.writerows(rows)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("videos", type=Path, nargs="+", help="video files and/or folders (searched recursively)")
    ap.add_argument("--out", type=Path, default=Path("raw"), help="dataset folder; frames go to <out>/images")
    ap.add_argument("--every", type=int, default=5, help="keep every Nth frame across the clip (0 = dense only)")
    ap.add_argument("--max-sparse", type=int, default=None, help="cap sparse frames per clip (spread evenly)")
    ap.add_argument("--min-change", type=float, default=2.0,
                    help="skip sparse frames whose mean grey change from the last kept frame is below this (0 = off)")
    ap.add_argument("--around", type=float, action="append", default=[],
                    help="contact time in ms; keeps every frame within --window-ms (single video only, repeatable)")
    ap.add_argument("--contacts", type=Path, help="CSV of `video,ms` contact times for many clips")
    ap.add_argument("--window-ms", type=float, default=300)
    ap.add_argument("--quality", type=int, default=95, help="JPEG quality")
    ap.add_argument("--overwrite", action="store_true")
    a = ap.parse_args(argv)

    videos = find_videos(a.videos)
    if not videos:
        ap.error("no videos found")
    if a.around and len(videos) != 1:
        ap.error("--around needs exactly one video; use --contacts for several")
    contacts = read_contacts(a.contacts) if a.contacts else {}

    total = dense_total = 0
    for video in videos:
        around = a.around or contacts.get(safe_stem(video.name), [])
        rows = extract_video(video, a.out, a.every, around, a.window_ms, a.max_sparse,
                             a.min_change, a.quality, a.overwrite)
        append_manifest(a.out, rows)
        dense = sum(int(r["dense"]) for r in rows)
        total, dense_total = total + len(rows), dense_total + dense
        print(f"{video.name}: {len(rows)} frames ({dense} around contact)")
    print(f"total {total} frames ({dense_total} around contact) in {a.out / 'images'}")


if __name__ == "__main__":
    main()
