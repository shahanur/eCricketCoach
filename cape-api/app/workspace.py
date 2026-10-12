"""Ephemeral per-request session directories (spec §7).

Artifacts are kept for ``artifact_ttl_seconds`` so callers can download them;
the uploaded video is purged as soon as processing finishes.
"""

import shutil
import time
import uuid
from pathlib import Path

from .config import Settings, get_settings

INPUT_STEM = "input"


class InvalidSessionId(ValueError):
    pass


def _root(settings: Settings | None) -> Path:
    return (settings or get_settings()).workspace_dir.resolve()


def _parse(session_id: str) -> str:
    try:
        parsed = uuid.UUID(session_id)
    except (ValueError, AttributeError, TypeError):
        raise InvalidSessionId("invalid session id") from None
    if parsed.version != 4 or str(parsed) != session_id:
        raise InvalidSessionId("invalid session id")
    return session_id


def session_path(session_id: str, settings: Settings | None = None) -> Path:
    root = _root(settings)
    path = (root / _parse(session_id)).resolve()
    if path.parent != root:
        raise InvalidSessionId("invalid session id")
    return path


def create_session(settings: Settings | None = None) -> tuple[str, Path]:
    session_id = str(uuid.uuid4())
    path = session_path(session_id, settings)
    path.mkdir(parents=True, exist_ok=False)
    return session_id, path


def purge_input(session_id: str, settings: Settings | None = None) -> None:
    for f in session_path(session_id, settings).glob(f"{INPUT_STEM}.*"):
        f.unlink(missing_ok=True)


def purge(session_id: str, settings: Settings | None = None) -> None:
    shutil.rmtree(session_path(session_id, settings), ignore_errors=True)


def sweep_expired(settings: Settings | None = None, now: float | None = None) -> int:
    """Delete session dirs idle longer than the TTL. Non-session entries are left alone."""
    settings = settings or get_settings()
    root = _root(settings)
    if not root.is_dir():
        return 0
    cutoff = (now if now is not None else time.time()) - settings.artifact_ttl_seconds
    removed = 0
    for entry in root.iterdir():
        try:
            _parse(entry.name)
        except InvalidSessionId:
            continue
        if entry.is_dir() and not entry.is_symlink() and entry.stat().st_mtime < cutoff:
            shutil.rmtree(entry, ignore_errors=True)
            removed += 1
    return removed
