import logging

from fastapi import Depends
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app, require_api_key
from app.schemas import CapeError


def client(tmp_path, **kw):
    app = create_app(Settings(workspace_dir=tmp_path / "ws", **kw))

    @app.get("/api/v1/_probe", dependencies=[Depends(require_api_key)])
    async def probe():
        return {"ok": True}

    @app.get("/api/v1/_fail")
    async def fail():
        raise CapeError(422, "no_contact_detected", "No bat contact found")

    return TestClient(app)


def test_health_and_lifespan_creates_workspace(tmp_path):
    with client(tmp_path) as c:
        assert c.get("/health").json() == {"status": "ok"}
        assert (tmp_path / "ws").is_dir()


def test_health_access_log_is_suppressed(tmp_path):
    create_app(Settings(workspace_dir=tmp_path / "ws"))
    access = logging.getLogger("uvicorn.access")

    def passes(path: str) -> bool:
        record = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 0,
                                   '%s - "%s %s HTTP/%s" %d', ("127.0.0.1:1", "GET", path, "1.1", 200), None)
        return access.filter(record)

    assert not passes("/health")
    assert not passes("/health?x=1")
    assert passes("/api/v1/analyze-cricket-video")
    create_app(Settings(workspace_dir=tmp_path / "ws"))
    assert sum(type(f).__name__ == "_HealthCheckFilter" for f in access.filters) == 1


def test_api_key(tmp_path):
    with client(tmp_path, api_key="s3cret") as c:
        assert c.get("/health").status_code == 200
        r = c.get("/api/v1/_probe")
        assert r.status_code == 401 and r.json()["error"] == "unauthorized"
        assert c.get("/api/v1/_probe", headers={"X-API-Key": "wrong"}).status_code == 401
        assert c.get("/api/v1/_probe", headers={"X-API-Key": "s3cret"}).json() == {"ok": True}


def test_error_shapes(tmp_path):
    with client(tmp_path) as c:
        r = c.get("/api/v1/_fail")
        assert r.status_code == 422
        assert r.json() == {"status": "error", "error": "no_contact_detected", "message": "No bat contact found"}
        r = c.get("/nope")
        assert r.status_code == 404 and r.json()["status"] == "error"
