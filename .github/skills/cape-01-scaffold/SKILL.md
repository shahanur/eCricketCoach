---
name: cape-01-scaffold
description: "CAPE 1/13 – scaffold the FastAPI service, config, schemas and workspace lifecycle"
disable-model-invocation: true
---
Follow `.github/instructions/cape-api.instructions.md` (contracts + token rules).

Spec: §6.1, §7 and §11.1 + §11.6.

Create `services/cape-api/` with:
- `requirements.txt` (pinned: fastapi, uvicorn[standard], python-multipart, pydantic-settings, numpy, opencv-python-headless, ultralytics, mediapipe, pyyaml) and `requirements-dev.txt` (pytest, httpx).
- `app/config.py`: `Settings` with `workspace_dir`, `weights_dir`, `device`, `max_upload_mb=500`, `artifact_ttl_seconds=900`, `api_key` (optional).
- `app/schemas.py`:
  - Enums from §11.1.
  - `AnalysisRequest` with a validator: `shot_type` is required for batter and `bowler_type` for bowler.
  - Response models reproducing §6.1 extended by §11.6: `Metadata`, `PreContact`, `PointOfContact`, `PostContact`, `Delivery`, `Fault`, `Coaching`, `DownloadEndpoints` (per-target artifact keys + `all_zip`), `AnalysisResponse`.
  - `ErrorResponse`.
- `app/workspace.py`: `create_session() -> (uuid, Path)`, `session_path(uuid)` (rejects non-UUID), `purge(uuid)`, `sweep_expired()`.
  §7 says purge right after the response, but the response returns download links. Keep artifacts for `artifact_ttl_seconds`, purge the uploaded video immediately, and sweep expired sessions on startup and every minute.
- `app/main.py`: app factory, `GET /health`, optional `X-API-Key` check when `api_key` is set, JSON error handlers.
- `tests/test_workspace.py` (create/purge/sweep, path-traversal rejection) and `tests/test_schemas.py` (request validator).
