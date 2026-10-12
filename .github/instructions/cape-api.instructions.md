---
applyTo: "cape-api/**"
description: Shared rules and fixed module contracts for the CAPE video-analysis API.
---

# CAPE API – shared context

Spec: `docs/video-analysis-api.md`. Read **only** the section a task names: grep its heading, then view that line range. Don't read the whole doc, `web-app/` or `mobile-app/` unless the task says so.

## Architecture (fixed)
```text
Mobile/Web ──► Express API (Node) ──enqueue──► Redis (BullMQ "cape-analysis")
                                                   │
                       Node worker (concurrency = GPU slots) ──HTTP──► CAPE (Python, GPU)
```
- CAPE is an **internal, stateless** inference service: no database, no user/tenant data, no public port, `X-API-Key` required. Its HTTP call is synchronous; queueing, retries, auth, tenancy, Drive and persistence all live in Node.
- Node is the only public API. Clients never call CAPE or see its URL.

## Stack
Python 3.11, FastAPI, Uvicorn, Pydantic v2 + pydantic-settings, NumPy, opencv-python-headless, Ultralytics (YOLOv11), MediaPipe. Kalman filter is hand-rolled in NumPy (no filterpy). Tests: pytest + FastAPI `TestClient`.

## Layout (fixed – do not rename)
```text
cape-api/
  app/main.py            FastAPI app + routes
  app/config.py          Settings (env prefix CAPE_)
  app/schemas.py         Pydantic models mirroring spec §6.1
  app/workspace.py       session dirs, TTL cleanup
  app/ingest.py          streamed upload save, video metadata probe
  app/calibration.py     homography pixel→metres
  app/kinematics.py      joint angles (spec §9)
  app/bowling.py         speed, pitching point, line/length (spec §11.4)
  app/coaching.py        faults, score, recommendations (spec §11.3–11.5)
  app/rules/coaching_rules.yaml
  app/models/base.py     dataclasses + Protocols
  app/models/{ball,pose,bat,landmarks}.py   YOLO / MediaPipe adapters
  app/tracking/kalman.py
  app/tracking/state_machine.py
  app/render.py          overlays + milestone JPEGs
  app/pipeline.py        orchestrator
  training/              ball dataset config + train script
  tests/test_<module>.py
  Dockerfile             CUDA 12.2 base + PyTorch 2.5.1 cu121 (works with NVIDIA driver ≥ 530), Python 3.11 venv in /opt/venv, non-root, uvicorn app.main:app (CAPE_WORKERS, default 1)
  docker-compose.yml     GPU reservation; ./weights (ro) and ./cricket_workspace volumes; optional .env
  docker-compose.cpu.yml CPU override (CAPE_DEVICE=cpu, no GPU reservation)
```

## Contracts (fixed – other tasks depend on them)
- `Point = tuple[float, float]`, `Point3 = tuple[float, float, float]` (defined in `schemas.py`).
- `models/base.py`: `@dataclass Box(x1, y1, x2, y2, conf, cls)` with `.center -> Point`, `.area`; `@dataclass PoseResult(box: Box, keypoints: list[Point])`; `@dataclass Landmarks(points: dict[str, Point3])` — **full-frame pixels, z scaled like x** (isotropic for angles), MediaPipe names, low-visibility (<0.5) points omitted.
  Protocols: `BallDetector.detect(frame) -> Box | None`, `PoseDetector.detect(frame) -> list[PoseResult]` (sorted by conf desc), `BatSegmenter.segment(frame) -> np.ndarray | None` (Nx2 polygon), `LandmarkEstimator.estimate(crop) -> Landmarks | None`.
- `models.load_detectors(settings) -> Detectors(ball, pose, bat, landmarks, device, fallbacks)`: cached, checks `ball.pt`, `yolo11n-pose.pt`, `bat-seg.pt` in `CAPE_WEIGHTS_DIR` (raises `MissingWeightsError`), libraries load on first inference. Until custom models are trained, a missing `ball.pt`/`bat-seg.pt` falls back to pretrained COCO `yolo11n.pt` (class 32 "sports ball" → `cricket_ball`, `min_conf` 0.15) / `yolo11n-seg.pt` (class 34 "baseball bat"), logged and listed in `fallbacks`; a custom file always wins. `MediaPipeLandmarks.estimate_in_frame(frame, box, pad=0.15)` crops via `landmarks.crop_roi(frame, box, pad) -> (crop, (x0, y0)) | None` and returns full-frame coordinates.
- `calibration.Calibrator(pixel_pts: list[Point], metre_pts: list[Point])`: `.matrix` (3×3), `.inverse`, `.to_metres(p) -> Point`, `.to_pixels(p_m) -> Point`, `.speed_kmh(p0, p1, dt) -> float`; raises `ValueError` on degenerate points, a point on the vanishing line, or `dt <= 0` (callers map it to `CapeError(422, "calibration_invalid", …)`).
- `kinematics.joint_angle(a, b, c: Point3) -> float` (degrees, vertex `b`; `ValueError` on zero-length segment); `kinematics.batter_angles(lm: Landmarks, handedness) -> dict[str, float]`; `pose_metrics(lm, handedness) -> dict[str, float]`; `head_travel_pct(lm_a, lm_b) -> float | None`; `torso_length(lm) -> float | None`; `sides(handedness) -> (front, back)`; `ANGLE_METRICS`; `angle_points(lm, handedness, metric) -> (A, B, C) | None`. Front side = left for a right-hander. Missing landmarks omit keys.
  Metric keys (used by `coaching_rules.yaml`): `front_elbow`, `back_elbow`, `front_knee`, `back_knee`, `front_shoulder`, `back_shoulder` (degrees); `head_front_knee_offset_pct` (+ = head ahead of front knee); `torso_length`, `hip_center_x/_y`, `front_ankle_x/_y`, `back_ankle_x/_y` (landmark image units). The pipeline adds `head_travel_pct` and any metric-space values (e.g. stride in metres).
- `tracking.state_machine`: `Phase` StrEnum `PRE_CONTACT | AT_CONTACT | POST_CONTACT`; `Tracker(min_speed_px=2, max_gap=8, warmup=3, confirm_frames=1)`; `Tracker.update(frame_idx: int, ball: Point | None) -> Phase` (one call per frame, increasing idx; returns AT_CONTACT once, on the confirming frame); `Tracker.contact_frame: int | None` (= inversion vertex frame); `Tracker.history(phase) -> list[tuple[int, Point]]` (POST includes Kalman-filled points, listed in `Tracker.filled_frames`). `tracking.kalman.Kalman2D(p0, v0, process_noise, measurement_noise)`: `predict()`, `update(p)`, `step(p | None)`.
- `schemas.AnalysisRequest(target, handedness, shot_type | None, bowler_type | None, calibration_points, pitch_points_m | None)`: `shot_type` is required for batter, `bowler_type` for bowler (spec §11.1).
- `schemas`: `Point`/`Point3` are defined here (re-export them from `models/base.py`); `ARTIFACT_NAMES[target]`, `ALL_ARTIFACT_NAMES`, `ZIP_NAME`, `DownloadEndpoints.for_session(session_id, target)`; raise `schemas.CapeError(status, code, message)` for any 4xx outcome.
- **Pitch frame** (`schemas.DEFAULT_PITCH_POINTS_M`, `req.pitch_points`): metres, origin = batter's middle stump at ground level, +y towards the bowler, +x = right as seen from the bowler's end. Calibration taps are in the same order: batter-end left, batter-end right, bowler-end right, bowler-end left. Off side = −x for a right-handed batter, +x for a left-hander.
- `main`: `create_app(settings)`; protect every `/api/v1` route with `Depends(main.require_api_key)`; read settings via `Depends(main.app_settings)`. The analyse route passes `app.state.detectors` to `pipeline.analyze`; the lifespan loads it via `load_detectors` and leaves it `None` (logged) on `MissingWeightsError`. Tests inject fakes on `app.state.detectors`.
- `ingest`: `validate_upload(filename, content_type) -> ext`, `save_upload(src, dest, max_bytes)`, `probe(path) -> {fps, width, height, frame_count}`.
- `workspace`: `create_session(settings) -> (id, Path)`, `session_path(id, settings)`, `purge_input(id, settings)`, `purge(id, settings)`, `sweep_expired(settings)`; `InvalidSessionId`.
- `bowling.delivery_metrics(ball_track: list[tuple[int, Point]], cal: Calibrator, fps, req) -> schemas.Delivery | None` (spec §11.4): release = first track point; pitching point = first down→up turn of the 3-point-smoothed image-y velocity (`bounce_index(track, settled=False)`; `settled=True` ignores turns that later points could still change, for streaming); speed = ground-projected release→pitch distance / time, rounded (`None` if fps ≤ 0); `None` if there's no bounce. Also `length_zone(length_m, bowler_type)`, `line_zone(offset_m)`. Use it for bowlers only.
- `coaching.evaluate(req, metrics: dict[str, float], delivery: Delivery | None) -> schemas.Coaching`, driven by `app/rules/coaching_rules.yaml` (spec §11.3–11.5; `load_rules()` is cached and validates the file). Each check looks up `"<milestone>.<metric>"` first, then `"<metric>"`; missing metrics go to `unavailable`. Severity = deviation % of `scale` (default = the violated bound) against `severity_bands` (default `[10, 25]`); score = 100 − (high 20, medium 10, low 5), clamped. The bowling verdict is `describe_delivery(delivery)` (e.g. "Good-length ball in the off-stump channel at 118 km/h") plus the top pose-fault verdict. The YAML `length_zones`/`line_zones` must match the `schemas` tables (tested).
  Metrics the pipeline must supply besides `pose_metrics` keys: `head_travel_pct` (pre-contact → contact), `bat_angle_deg` (bat from vertical), `stride_m` (front-to-back ankle distance in pitch metres), `bat_ahead_of_pad_cm`, and `release_height_m` (bowler).   Batting checks use milestone `point_of_contact`; bowling pose checks use `release` (the bowling arm is `back_elbow`). `applicable_checks(req)` returns the pose checks for the request.
  - `pipeline.analyze(video_path, req, session_dir, detectors) -> schemas.AnalysisResponse`: one decode pass with a ring buffer. Batter: `Tracker` contact → pre-contact (contact − 0.15 s) / contact / post-contact (contact + max(5 frames, 0.2 s)) frames; batter = person whose feet are nearest the batter-stumps pixel. Bowler: release = first ball detection, pitching point = settled bounce; bowler = moving person nearest the bowling crease; bowling arm = higher wrist. Errors: `detectors is None` → 503 `models_unavailable`; 422 `calibration_invalid`, `unreadable_video`, `no_contact_detected`, `no_pitching_point_detected`. Download URLs for artifacts that weren't written are `None`.
- `schemas` zones (spec §11.4): `LENGTH_ZONES_M[BowlerType] -> [(LengthZone, lo_m, hi_m)]` (pitch y, half-open), `LINE_ZONES_M -> [(LineZone, lo, hi)]` keyed on the off-side offset, `line_offset_m(x, handedness)` (+ = off side), `pitch_x_from_offset(off, handedness)`, `POPPING_CREASE_M`, `STUMPS_WIDTH_M`. Reuse these; do not duplicate the thresholds.
- `render`: all draw functions return a copy and never mutate their input; colours are BGR. `draw_trail(img, pts)`, `draw_metrics(img, lines)`, `draw_contact(img, pt)`, `draw_angle(img, a, b, c, deg, status)` with `status in STATUS_COLORS` (`ok`/`warn`/`fault`, otherwise `ValueError`), `draw_skeleton(img, points: {landmark: (x, y)})` (body links plus labelled head/elbow/knee key points), `draw_alignment(img, head, knee=None, ball=None, status="ok")` (head plumb line vs front knee plus dashed head-to-ball sight line), `draw_ball(img, pt)`, `pitch_to_map_px(pt_m, size)`, `draw_pitch_map(delivery, size=(400, 900), bowler_type=pace, handedness=right)` (batter stumps at the top). `export_artifacts(session_dir, target, frames: {milestone: img}, overlays: {milestone: [callable(img) -> img]} | None) -> {file_name: Path}`: milestones are `ARTIFACT_KEYS[target]` (batter `pre_contact`/`point_of_contact`/`post_contact`; bowler `release`/`pitching_point`/`pitch_map`). Missing frames are skipped; an unknown key raises `ValueError`. Writes atomic JPEGs at quality 90.
- `training` (spec §10): `ball.yaml` classes `0: cricket_ball`, `1: blurred_ball` (= `models.ball.BALL_CLASSES`). `split_dataset.group_key(stem, pattern)`, `plan_split(images, ratios, seed, pattern)`, `split_dataset(src, out, ratios=(0.8, 0.1, 0.1), seed, pattern, move=False) -> {split: count}`: frames of one source video always land in the same split. `train_ball` fine-tunes `yolo11n.pt` and installs `best.pt` as `weights/ball.pt`.
- Artifacts in the session dir (spec §11.7). Batter: `1_pre_contact.jpg`, `2_point_of_contact.jpg`, `3_post_contact.jpg`. Bowler: `1_release.jpg`, `2_pitching_point.jpg`, `3_pitch_map.jpg`. Plus `all.zip`.
- **Node side** (`web-app/server`, task 12): Prisma `CapeJob` (`cape_jobs`, DDL in `initDb.ts`; status `QUEUED|RUNNING|SUCCEEDED|FAILED`, `error` = CAPE/worker error code, `artifacts` = `{ "<file name>": driveFileId }`). `queues/capeQueue.ts`: `createCapeJob({tenantId, createdById, request, playerId?, playerName?, assessmentId?, driveFileId? | uploadPath?})` (creates + enqueues), `stageCapeUpload(buffer, originalName) -> path` (in `CAPE_UPLOAD_DIR`), `capeQueuePosition(id)`. `services/capeClient.ts`: `analyzeWithCape`, `downloadCapeArtifact`, `isCapeConfigured()`, `CapeError(status, code, message, retryable)`. The worker stores `result` with `download_endpoints` rewritten to `/api/club/cape-jobs/<jobId>/artifacts/<file name>` (`all.zip` included when any image was stored; `null` if Drive isn't connected). Drive helpers in `routes/googleDrive.ts`: `downloadDriveFile(userId, fileId) -> Buffer`, `downloadDriveFileToPath`, `resolveDriveFolder`, `uploadFileToDriveFolder`.
- **Node API + clients** (task 13): `POST /api/club/assessments/:id/video` with `engine=cape` (multipart `video`, or JSON with `driveFileId`) plus `target`, `handedness`, `shot_type` | `bowler_type`, `calibration_points` (4 `[x,y]` video pixels, JSON string in multipart) and optional `pitch_points_m` → `202 {jobId, status}`. `target` must match the discipline (BATTING→batter, BOWLING→bowler; else 409); 503 `cape_unavailable` when CAPE isn't configured. `GET /api/club/assessments/:id/video` adds `capeJob` (latest job or `null`). `routes/capeJobs.ts` (mounted at `/api/club/cape-jobs`): `GET /:jobId` → `{job: capeJobView}` (`jobId, status, queuePosition?, attempts, error, errorMessage, request, result?, createdAt, updatedAt`); `GET /:jobId/artifacts/<n_name>.jpg|all.zip` streams from Drive as `<Player>_<yyyy-mm-dd>_<name>` (ZIP built on the fly). Access is tenant-scoped: CLUB_ADMIN all, COACH own or assessment-coach jobs, PLAYER own jobs. User-facing text comes from `friendlyCapeError(code)`. Clients poll the job (3 s, ×1.3 back-off, ≤ 15 s): web `CapeAnalysisPanel.tsx`, mobile `CapeResultPanel.kt` (images saved to `Pictures/eCricketCoach`, ZIP to Downloads).
- **Standalone jobs** (AI Video Analysis tab): `POST /api/club/cape-jobs` (CLUB_ADMIN/active club COACH; multipart `file` or JSON `driveFileId`, plus `playerId` of an active club PLAYER and the same CAPE fields; no assessment, so any target) → `202 {jobId, status}`; `GET /api/club/cape-jobs/latest?playerId=&target=` → `{job}` (latest job with `assessmentId = null`; coaches see only their own). `GET /api/google-drive/videos/:fileId/content` streams the user's own Drive video (≤ 500 MB) so the browser can calibrate its first frame. `CapeAnalysisPanel` takes `assessmentId` (own file picker) or `playerId` + `source {name, file? | driveFileId?}`.

## Product goal
The user uploads a clip and gets: the pose (joint angles against ideal ranges); for batting, faults for that shot; for bowling, speed, line and length against a good ball; a recommendation and drill per fault; and downloadable annotated images. Every module serves that output (spec §11).

## Rules
- Models load lazily from `CAPE_WEIGHTS_DIR`; device from `CAPE_DEVICE` (`cuda`/`cpu`, fall back to cpu). Never download weights at import time.
- Unit tests must not need a GPU, weights or a real video: use synthetic NumPy frames and fake detectors implementing the Protocols.
- Validate inputs (video MIME/extension, size ≤ `CAPE_MAX_UPLOAD_MB`, exactly 4 calibration points, `target`/`handedness`/`shot_type`/`bowler_type` enums per spec §11.1). Return 4xx JSON errors, never stack traces.
- Session IDs are UUID4; never build file paths from raw user input.
- If a task needs a contract change, stop and report rather than editing other modules.

## Token discipline
- Don't restate the spec or paste whole files in chat.
- Verify only the module you touched: `cd cape-api; .\.venv\Scripts\python.exe -m pytest tests/test_<module>.py -q` (the venv has the light deps only; `pip install` heavy ones such as numpy/opencv into it only when a task needs them).
- Final reply ≤ 5 lines: files changed, verification result, open issues.
