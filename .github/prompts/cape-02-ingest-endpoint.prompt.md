---
agent: agent
description: CAPE 2/13 – upload ingestion and REST endpoints
---

Follow `.github/instructions/cape-api.instructions.md` (contracts + token rules).

Spec: §3.1 (first bullet only), §11.1 and §11.7.

- `app/ingest.py`: stream `UploadFile` to `<session>/input.<ext>` in 1 MB chunks, enforce the size limit while streaming, and allow mp4/mov/m4v/avi/mkv only. `probe(path) -> {fps, width, height, frame_count}` via OpenCV; reject unreadable videos or fps ≤ 0.
- `POST /api/v1/analyze-cricket-video` (multipart):
  - `file`, plus the `AnalysisRequest` fields as form fields, with `calibration_points` as a JSON array of 4 `[x, y]`.
  - Optional `pitch_points_m`, defaulting to the 4 crease corners of a 20.12 m × 3.05 m pitch.
  - Run `pipeline.analyze` in a threadpool. Until task 9 exists, call a stub that raises 501.
- `GET /api/v1/artifacts/{session_id}/{name}`: `name` must be one of the §11.7 artifact names for that session or `all.zip`. Serve with `Content-Disposition: attachment`, building the ZIP lazily; otherwise return 404.
- `tests/test_api.py`: validation errors (bad enums, missing `shot_type`, wrong point count, oversize, bad extension) and artifact 404/200/ZIP, using a tiny synthetic video written with `cv2.VideoWriter`.
