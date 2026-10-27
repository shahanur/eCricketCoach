"""Upload persistence and video probing (spec §3.1)."""

from collections.abc import Iterator
from pathlib import Path
from typing import BinaryIO

import cv2
import numpy as np

from .schemas import CapeError

CHUNK_SIZE = 1024 * 1024
ALLOWED_EXTENSIONS = frozenset({".mp4", ".mov", ".m4v", ".avi", ".mkv"})
_GENERIC_CONTENT_TYPES = frozenset({"", "application/octet-stream"})
# Trimmed/re-muxed clips can start with access units that hold no picture; players skip
# them, so tolerate a few failed reads before treating the stream as ended.
MAX_CONSECUTIVE_READ_FAILURES = 8


def read_frames(cap: "cv2.VideoCapture") -> Iterator[np.ndarray]:
    """Yield decodable frames in order, skipping isolated undecodable packets.

    Frame indices used across CAPE (manual frames, thumbnails, milestones) count only
    the frames yielded here, so every reader must go through this helper.
    """
    failures = 0
    while failures < MAX_CONSECUTIVE_READ_FAILURES:
        ok, frame = cap.read()
        if ok and frame is not None:
            failures = 0
            yield frame
        else:
            failures += 1


def validate_upload(filename: str | None, content_type: str | None) -> str:
    """Return the normalised extension, or raise 415."""
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise CapeError(415, "unsupported_media_type", f"Allowed video types: {', '.join(sorted(ALLOWED_EXTENSIONS))}")
    ctype = (content_type or "").split(";", 1)[0].strip().lower()
    if ctype not in _GENERIC_CONTENT_TYPES and not ctype.startswith("video/"):
        raise CapeError(415, "unsupported_media_type", "Upload must be a video file")
    return ext


def save_upload(src: BinaryIO, dest: Path, max_bytes: int) -> int:
    """Copy ``src`` to ``dest`` in chunks, aborting with 413 once ``max_bytes`` is exceeded."""
    total = 0
    try:
        with dest.open("xb") as out:
            while chunk := src.read(CHUNK_SIZE):
                total += len(chunk)
                if total > max_bytes:
                    raise CapeError(413, "file_too_large", f"Video exceeds {max_bytes // (1024 * 1024)} MB")
                out.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    if total == 0:
        dest.unlink(missing_ok=True)
        raise CapeError(422, "empty_file", "Uploaded video is empty")
    return total


def probe(path: Path) -> dict:
    cap = cv2.VideoCapture(str(path))
    try:
        if not cap.isOpened():
            raise CapeError(422, "unreadable_video", "Video could not be decoded")
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        ok = next(read_frames(cap), None) is not None
    finally:
        cap.release()
    if not ok or width <= 0 or height <= 0:
        raise CapeError(422, "unreadable_video", "Video could not be decoded")
    if fps <= 0:
        raise CapeError(422, "unreadable_video", "Video frame rate could not be determined")
    return {"fps": fps, "width": width, "height": height, "frame_count": frame_count}
