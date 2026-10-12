import asyncio
import contextlib
import json
import logging
import os
import secrets
import uuid
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, File, Form, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import APIKeyHeader
from pydantic import ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import ingest, pipeline, workspace
from .config import Settings, get_settings
from .schemas import ALL_ARTIFACT_NAMES, ZIP_NAME, AnalysisRequest, AnalysisResponse, CapeError, ErrorResponse

log = logging.getLogger("cape")

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
# Multipart framing + form fields on top of the video itself.
_BODY_OVERHEAD_BYTES = 1024 * 1024


def _error(status_code: int, code: str, message: str, details: list[dict] | None = None) -> JSONResponse:
    body = ErrorResponse(error=code, message=message, details=details)
    return JSONResponse(status_code=status_code, content=body.model_dump(exclude_none=True))


def app_settings(request: Request) -> Settings:
    return request.app.state.settings


async def require_api_key(
    key: str | None = Depends(_api_key_header), settings: Settings = Depends(app_settings)
) -> None:
    """Apply to every /api/v1 route. No-op when CAPE_API_KEY is unset (local dev only)."""
    expected = settings.api_key.get_secret_value() if settings.api_key else None
    if expected and not (key and secrets.compare_digest(key.encode(), expected.encode())):
        raise CapeError(401, "unauthorized", "Missing or invalid API key")


async def _sweeper(settings: Settings) -> None:
    while True:
        await asyncio.sleep(settings.sweep_interval_seconds)
        try:
            await asyncio.to_thread(workspace.sweep_expired, settings)
        except Exception:
            log.exception("workspace sweep failed")


router = APIRouter(prefix="/api/v1", dependencies=[Depends(require_api_key)])


def _parse_points(name: str, raw: str | None):
    if raw is None or raw == "":
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise RequestValidationError(
            [{"loc": ("body", name), "msg": "must be a JSON array of 4 [x, y] pairs", "type": "json_invalid"}]
        ) from None


def _build_request(**fields) -> AnalysisRequest:
    data = {k: v for k, v in fields.items() if v not in (None, "")}
    try:
        return AnalysisRequest.model_validate(data)
    except ValidationError as e:
        raise RequestValidationError([{**err, "loc": ("body", *err["loc"])} for err in e.errors()]) from None


def _check_points_in_frame(req: AnalysisRequest, meta: dict) -> None:
    w, h = meta["width"], meta["height"]
    if any(x > w or y > h for x, y in req.calibration_points):
        raise CapeError(422, "calibration_out_of_frame", f"Calibration points must lie within the {w}x{h} frame")


@router.post("/analyze-cricket-video", response_model=AnalysisResponse, response_model_exclude_none=False)
async def analyze_cricket_video(
    request: Request,
    file: UploadFile = File(...),
    target: str = Form(...),
    handedness: str = Form(...),
    calibration_points: str = Form(...),
    shot_type: str | None = Form(None),
    bowler_type: str | None = Form(None),
    pitch_points_m: str | None = Form(None),
    settings: Settings = Depends(app_settings),
) -> AnalysisResponse:
    req = _build_request(
        target=target,
        handedness=handedness,
        shot_type=shot_type,
        bowler_type=bowler_type,
        calibration_points=_parse_points("calibration_points", calibration_points),
        pitch_points_m=_parse_points("pitch_points_m", pitch_points_m),
    )
    ext = ingest.validate_upload(file.filename, file.content_type)

    session_id, session_dir = workspace.create_session(settings)
    try:
        video_path = session_dir / f"{workspace.INPUT_STEM}{ext}"
        await run_in_threadpool(ingest.save_upload, file.file, video_path, settings.max_upload_bytes)
        meta = await run_in_threadpool(ingest.probe, video_path)
        _check_points_in_frame(req, meta)
        detectors = getattr(request.app.state, "detectors", None)
        result = await run_in_threadpool(pipeline.analyze, video_path, req, session_dir, detectors)
    except BaseException:
        workspace.purge(session_id, settings)
        raise
    finally:
        await file.close()
    workspace.purge_input(session_id, settings)
    return result


def _ensure_zip(session_dir: Path) -> Path:
    zip_path = session_dir / ZIP_NAME
    if zip_path.is_file():
        return zip_path
    members = sorted(p for p in session_dir.iterdir() if p.name in ALL_ARTIFACT_NAMES and p.is_file())
    if not members:
        raise CapeError(404, "not_found", "Artifact not found")
    tmp = session_dir / f".{ZIP_NAME}.{uuid.uuid4().hex}.tmp"
    with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_STORED) as zf:
        for p in members:
            zf.write(p, arcname=p.name)
    os.replace(tmp, zip_path)
    return zip_path


@router.get("/artifacts/{session_id}/{name}")
async def get_artifact(session_id: str, name: str, settings: Settings = Depends(app_settings)) -> FileResponse:
    if name != ZIP_NAME and name not in ALL_ARTIFACT_NAMES:
        raise CapeError(404, "not_found", "Artifact not found")
    try:
        session_dir = workspace.session_path(session_id, settings)
    except workspace.InvalidSessionId:
        raise CapeError(404, "not_found", "Artifact not found") from None
    if not session_dir.is_dir():
        raise CapeError(404, "not_found", "Artifact not found")
    if name == ZIP_NAME:
        path = await run_in_threadpool(_ensure_zip, session_dir)
        media_type = "application/zip"
    else:
        path = session_dir / name
        if not path.is_file():
            raise CapeError(404, "not_found", "Artifact not found")
        media_type = "image/jpeg"
    return FileResponse(path, media_type=media_type, filename=name, content_disposition_type="attachment")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app_: FastAPI):
        settings.workspace_dir.mkdir(parents=True, exist_ok=True)
        if app_.state.detectors is None:
            from .models import MissingWeightsError, load_detectors

            try:
                app_.state.detectors = load_detectors(settings)
            except MissingWeightsError as exc:
                log.warning("Analysis disabled: %s", exc)
        await asyncio.to_thread(workspace.sweep_expired, settings)
        task = asyncio.create_task(_sweeper(settings))
        try:
            yield
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    app = FastAPI(title="CAPE", version="0.1.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.state.settings = settings
    app.state.detectors = None  # loaded in lifespan; stays None (503 models_unavailable) without weights

    @app.middleware("http")
    async def _limit_body(request: Request, call_next):
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > settings.max_upload_bytes + _BODY_OVERHEAD_BYTES:
            return _error(413, "file_too_large", f"Video exceeds {settings.max_upload_mb} MB")
        return await call_next(request)

    @app.exception_handler(CapeError)
    async def _cape_error(_: Request, exc: CapeError) -> JSONResponse:
        return _error(exc.status_code, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"loc": list(e.get("loc", ())), "msg": e.get("msg", ""), "type": e.get("type", "")} for e in exc.errors()]
        return _error(422, "validation_error", "Request validation failed", jsonable_encoder(details))

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _error(exc.status_code, "http_error", str(exc.detail))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error", exc_info=exc)
        return _error(500, "internal_error", "Internal server error")

    @app.get("/health", include_in_schema=False)
    async def health() -> dict:
        return {"status": "ok"}

    app.include_router(router)
    return app


app = create_app()
