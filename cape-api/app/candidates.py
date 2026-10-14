"""Thumbnails around the likely bat-ball contact frame for manual milestone selection.

Used when a clip is too poor for automatic contact detection: the user picks the
pre-contact, contact and post-contact frames from these, and sends the indices back
as `manual_frames` on the analyse request.
"""

from __future__ import annotations

import base64
import logging
import math
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from .config import Settings
from .gemini_contact import GeminiContactError, select_contact_frame
from .schemas import CandidateFrame, CapeError, ContactCandidatesResponse

log = logging.getLogger("cape")

THUMB_WIDTH = 480
DEFAULT_BEFORE = 15
DEFAULT_AFTER = 10
MAX_WINDOW = 40


def _thumbnail(frame: np.ndarray) -> str:
    height, width = frame.shape[:2]
    out_w = min(THUMB_WIDTH, width)
    out_h = max(1, round(height * out_w / width))
    image = cv2.resize(frame, (out_w, out_h), interpolation=cv2.INTER_AREA)
    ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 80])
    if not ok:
        raise CapeError(422, "unreadable_video", "Video frames could not be encoded")
    return base64.b64encode(encoded.tobytes()).decode("ascii")


def _video_info(video_path: Path) -> tuple[float, int]:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise CapeError(422, "unreadable_video", "Video could not be decoded")
    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
        count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    finally:
        cap.release()
    return (fps if math.isfinite(fps) and fps > 0 else 30.0), max(count, 0)


def _read_window(video_path: Path, start: int, stop: int) -> dict[int, np.ndarray]:
    """Decode frames sequentially (same indexing as the analysis pass) and keep [start, stop]."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise CapeError(422, "unreadable_video", "Video could not be decoded")
    frames: dict[int, np.ndarray] = {}
    idx = 0
    try:
        while idx <= stop:
            ok, frame = cap.read()
            if not ok:
                break
            if idx >= start:
                frames[idx] = frame
            idx += 1
    finally:
        cap.release()
    return frames


def contact_candidates(
    video_path: Path,
    settings: Settings | None,
    pose_detector: Any | None = None,
    center_frame: int | None = None,
    before: int = DEFAULT_BEFORE,
    after: int = DEFAULT_AFTER,
) -> ContactCandidatesResponse:
    before = max(0, min(before, MAX_WINDOW))
    after = max(0, min(after, MAX_WINDOW))
    fps, frame_count = _video_info(video_path)

    suggested: int | None = None
    source = "none"
    note: str | None = None
    if center_frame is None:
        if settings and settings.gemini_contact and settings.gemini_api_key:
            try:
                selection = select_contact_frame(
                    video_path,
                    settings.gemini_api_key.get_secret_value(),
                    settings.gemini_model,
                    settings.gemini_timeout_seconds,
                    pose_detector,
                    settings.gemini_contact_lead_frames,
                )
                suggested, source = selection.frame_index, "gemini"
            except GeminiContactError as exc:
                log.warning("Gemini contact suggestion failed; showing the middle of the clip: %s", exc)
                note = "Automatic contact suggestion failed; showing frames from the middle of the clip."
        else:
            note = "Automatic contact suggestion is not configured; showing frames from the middle of the clip."
        center = suggested if suggested is not None else max(0, frame_count // 2)
    else:
        center = center_frame

    if frame_count:
        center = min(center, frame_count - 1)
    start, stop = max(0, center - before), center + after
    frames = _read_window(video_path, start, stop)
    if not frames:
        raise CapeError(422, "unreadable_video", "Video contains no decodable frames")
    return ContactCandidatesResponse(
        framerate_fps=round(fps, 3),
        frame_count=max(frame_count, max(frames) + 1),
        suggested_frame=suggested,
        suggestion_source=source,
        suggestion_note=note,
        frames=[
            CandidateFrame(index=i, time_s=round(i / fps, 3), image_base64=_thumbnail(frames[i]))
            for i in sorted(frames)
        ],
    )
