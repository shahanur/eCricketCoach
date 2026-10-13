"""Gemini-assisted visual selection of the bat-ball impact frame.

Gemini selects a frame and approximate impact pixel only. Measurements remain
deterministic and are calculated by CAPE from detector tracks and landmarks.
"""

from __future__ import annotations

import base64
import json
import logging
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np

log = logging.getLogger("cape")

MAX_COARSE_FRAMES = 48
TILES_PER_SHEET = 16
TILE_WIDTH = 320
FINE_FRAME_WIDTH = 768
TRANSIENT_HTTP_ATTEMPTS = 4
NETWORK_ATTEMPTS = 2


@dataclass(frozen=True)
class ContactSelection:
    frame_index: int
    confidence: float
    contact_point_norm: tuple[float, float] | None
    reason: str


class GeminiContactError(RuntimeError):
    pass


def _extract_json(text: str) -> dict:
    cleaned = text.replace("```json", "").replace("```", "").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end < start:
        raise GeminiContactError("Gemini response did not contain JSON")
    try:
        value = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as exc:
        raise GeminiContactError("Gemini returned invalid JSON") from exc
    if not isinstance(value, dict):
        raise GeminiContactError("Gemini response was not a JSON object")
    return value


def _read_frames(path: Path, indices: list[int]) -> tuple[dict[int, np.ndarray], float, int]:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise GeminiContactError("Video could not be decoded for Gemini contact selection")
    cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
    fps = fps if math.isfinite(fps) and fps > 0 else 30.0
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    wanted, frames, cursor = set(indices), {}, 0
    try:
        while wanted:
            ok, frame = cap.read()
            if not ok:
                break
            if cursor in wanted:
                frames[cursor] = frame
                wanted.remove(cursor)
            cursor += 1
    finally:
        cap.release()
    return frames, fps, count or cursor


def _sheet(frames: list[tuple[int, np.ndarray]], fps: float) -> bytes:
    tiles: list[np.ndarray] = []
    for idx, frame in frames:
        height, width = frame.shape[:2]
        resized_h = max(1, round(height * TILE_WIDTH / width))
        tile = cv2.resize(frame, (TILE_WIDTH, resized_h))
        label_h = 32
        labelled = cv2.copyMakeBorder(tile, label_h, 0, 0, 0, cv2.BORDER_CONSTANT, value=(12, 20, 31))
        text = f"FRAME {idx} | {idx / fps:.3f}s"
        cv2.putText(labelled, text, (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
        tiles.append(labelled)
    cols = 4
    rows = math.ceil(len(tiles) / cols)
    while len(tiles) < rows * cols:
        tiles.append(np.zeros_like(tiles[0]))
    sheet = np.vstack([np.hstack(tiles[i : i + cols]) for i in range(0, len(tiles), cols)])
    ok, encoded = cv2.imencode(".jpg", sheet, [cv2.IMWRITE_JPEG_QUALITY, 82])
    if not ok:
        raise GeminiContactError("Could not encode Gemini contact sheet")
    return encoded.tobytes()


def _batter_crop(frame: np.ndarray, pose_detector: Any | None) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    height, width = frame.shape[:2]
    if pose_detector is None:
        return frame, (0, 0, width, height)
    persons = pose_detector.detect(frame)
    if not persons:
        return frame, (0, 0, width, height)
    box = max(persons, key=lambda person: person.box.area).box
    pad_x, pad_y = (box.x2 - box.x1) * 0.4, (box.y2 - box.y1) * 0.2
    x0, y0 = max(0, round(box.x1 - pad_x)), max(0, round(box.y1 - pad_y))
    x1, y1 = min(width, round(box.x2 + pad_x)), min(height, round(box.y2 + pad_y))
    if x1 <= x0 or y1 <= y0:
        return frame, (0, 0, width, height)
    return frame[y0:y1, x0:x1], (x0, y0, x1, y1)


def _labelled_frame(idx: int, frame: np.ndarray, fps: float) -> bytes:
    """Encode one refinement frame at enough resolution to retain a blurred cricket ball."""
    height, width = frame.shape[:2]
    output_width = min(FINE_FRAME_WIDTH, width)
    resized_h = max(1, round(height * output_width / width))
    image = cv2.resize(frame, (output_width, resized_h), interpolation=cv2.INTER_AREA)
    image = cv2.copyMakeBorder(image, 44, 0, 0, 0, cv2.BORDER_CONSTANT, value=(12, 20, 31))
    cv2.putText(
        image,
        f"FRAME {idx} | {idx / fps:.3f}s",
        (12, 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )
    ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if not ok:
        raise GeminiContactError(f"Could not encode refinement frame {idx}")
    return encoded.tobytes()


def _request(api_key: str, model: str, prompt: str, sheets: list[bytes], timeout_s: float) -> dict:
    parts: list[dict] = [{"text": prompt}]
    parts.extend(
        {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(sheet).decode("ascii")}}
        for sheet in sheets
    )
    body = json.dumps(
        {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
        }
    ).encode()
    name = urllib.parse.quote(model.removeprefix("models/"), safe=".-_")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{name}:generateContent?key={api_key}"
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    payload = None
    last_error: Exception | None = None
    attempt = 0
    while True:
        try:
            with urllib.request.urlopen(req, timeout=timeout_s) as response:
                payload = json.load(response)
            break
        except urllib.error.HTTPError as exc:
            last_error = exc
            attempt += 1
            if exc.code not in (429, 500, 502, 503, 504) or attempt >= TRANSIENT_HTTP_ATTEMPTS:
                break
            retry_after = exc.headers.get("Retry-After")
            try:
                delay = min(10.0, max(1.0, float(retry_after))) if retry_after else float(2**attempt)
            except ValueError:
                delay = float(2**attempt)
            log.warning(
                "Gemini contact request returned HTTP %d; retrying in %.1fs (%d/%d)",
                exc.code,
                delay,
                attempt + 1,
                TRANSIENT_HTTP_ATTEMPTS,
            )
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            attempt += 1
            if attempt >= NETWORK_ATTEMPTS:
                break
            delay = 2.0
            log.warning("Gemini contact request failed; retrying once in %.1fs: %s", delay, exc)
        time.sleep(delay)
    if payload is None:
        raise GeminiContactError(f"Gemini contact request failed: {last_error}") from last_error
    try:
        text = payload["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise GeminiContactError("Gemini contact response contained no result") from exc
    return _extract_json(text)


def _parse_selection(data: dict, allowed: list[int]) -> ContactSelection:
    try:
        frame = int(data["frame_index"])
        confidence = min(1.0, max(0.0, float(data["confidence"])))
    except (KeyError, TypeError, ValueError) as exc:
        raise GeminiContactError("Gemini contact response omitted frame_index or confidence") from exc
    if frame not in allowed:
        frame = min(allowed, key=lambda candidate: abs(candidate - frame))
    point = data.get("contact_point_norm")
    contact = None
    if isinstance(point, list) and len(point) == 2:
        try:
            x, y = float(point[0]), float(point[1])
            if 0 <= x <= 1 and 0 <= y <= 1:
                contact = (x, y)
        except (TypeError, ValueError):
            pass
    return ContactSelection(frame, confidence, contact, str(data.get("reason", "")).strip())


def _prompt(stage: str, individual_frames: bool = False) -> str:
    presentation = (
        "Each attached image is one consecutive, high-resolution video frame labelled with its exact FRAME number."
        if individual_frames
        else "These contact sheets are chronological. Each tile is labelled with its exact FRAME number."
    )
    return f"""You are locating the exact bat-ball impact in a cricket batting clip.
{presentation}
{stage}
Choose only a displayed frame. Distinguish the moving bat in the batter's hands from stumps
and any spare bat. Impact is the EARLIEST frame with physical ball/blade overlap. A ball can be
partly hidden inside bat motion blur at impact; that occlusion is stronger evidence than a later,
clearer frame after the ball has departed. Trace the incoming ball across all frames, find the last
clearly pre-contact frame, and choose the immediately following first-overlap frame. Never choose
the clearest post-impact or follow-through frame.
Return only JSON:
{{"frame_index": integer, "confidence": number from 0 to 1,
  "contact_point_norm": [x, y] or null, "reason": "brief visible evidence"}}
The contact point is normalised within the chosen individual video frame, excluding its label bar."""


def select_contact_frame(
    video_path: Path,
    api_key: str,
    model: str = "gemini-flash-latest",
    timeout_s: float = 45,
    pose_detector: Any | None = None,
    lead_frames: int = 1,
) -> ContactSelection:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise GeminiContactError("Video could not be decoded for Gemini contact selection")
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.release()
    if frame_count <= 0:
        raise GeminiContactError("Video has no frames")

    stride = max(1, math.ceil(frame_count / MAX_COARSE_FRAMES))
    coarse_indices = list(range(0, frame_count, stride))
    if coarse_indices[-1] != frame_count - 1:
        coarse_indices.append(frame_count - 1)
    coarse_frames, fps, _ = _read_frames(video_path, coarse_indices)
    coarse_indices = [idx for idx in coarse_indices if idx in coarse_frames]
    sheets = [
        _sheet([(idx, coarse_frames[idx]) for idx in coarse_indices[i : i + TILES_PER_SHEET]], fps)
        for i in range(0, len(coarse_indices), TILES_PER_SHEET)
    ]
    coarse = _parse_selection(
        _request(api_key, model, _prompt("First make a coarse selection of the impact neighbourhood."), sheets, timeout_s),
        coarse_indices,
    )

    # Coarse sheets can lose a small blurred ball and bias selection towards a
    # clearer post-impact frame. Search up to 0.75 s earlier, but only 0.2 s
    # later, then compare those frames individually at high resolution.
    start = max(0, coarse.frame_index - max(stride, math.ceil(fps * 0.75)))
    stop = min(frame_count - 1, coarse.frame_index + max(stride, math.ceil(fps * 0.2)))
    fine_indices = list(range(start, stop + 1))
    fine_frames, fps, _ = _read_frames(video_path, fine_indices)
    fine_indices = [idx for idx in fine_indices if idx in fine_frames]
    crops = {idx: _batter_crop(fine_frames[idx], pose_detector) for idx in fine_indices}
    fine_images = [_labelled_frame(idx, crops[idx][0], fps) for idx in fine_indices]
    selection = _parse_selection(
        _request(
            api_key,
            model,
            _prompt(
                "Refine the coarse result by comparing every consecutive image and choose the first-overlap frame.",
                individual_frames=True,
            ),
            fine_images,
            timeout_s,
        ),
        fine_indices,
    )
    if selection.contact_point_norm is not None:
        x0, y0, x1, y1 = crops[selection.frame_index][1]
        frame_h, frame_w = fine_frames[selection.frame_index].shape[:2]
        crop_x, crop_y = selection.contact_point_norm
        selection = ContactSelection(
            selection.frame_index,
            selection.confidence,
            ((x0 + crop_x * (x1 - x0)) / frame_w, (y0 + crop_y * (y1 - y0)) / frame_h),
            selection.reason,
        )
    if lead_frames and selection.frame_index > 0:
        corrected = max(0, selection.frame_index - lead_frames)
        selection = ContactSelection(
            corrected,
            selection.confidence,
            selection.contact_point_norm,
            f"Temporal lead correction from Gemini frame {selection.frame_index}: {selection.reason}",
        )
    log.info(
        "Gemini selected batting contact frame %d (%.3fs, confidence %.2f): %s",
        selection.frame_index,
        selection.frame_index / fps,
        selection.confidence,
        selection.reason,
    )
    return selection
