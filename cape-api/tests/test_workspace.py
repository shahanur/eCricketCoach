import os
import time
import uuid

import pytest

from app import workspace
from app.config import Settings


@pytest.fixture
def settings(tmp_path):
    return Settings(workspace_dir=tmp_path / "ws", artifact_ttl_seconds=60)


def test_create_and_purge(settings):
    sid, path = workspace.create_session(settings)
    assert uuid.UUID(sid).version == 4
    assert path.is_dir() and path.parent == settings.workspace_dir.resolve()
    assert workspace.session_path(sid, settings) == path

    workspace.purge(sid, settings)
    assert not path.exists()
    workspace.purge(sid, settings)  # idempotent


def test_purge_input_keeps_artifacts(settings):
    sid, path = workspace.create_session(settings)
    (path / "input.mp4").write_bytes(b"x")
    (path / "1_pre_contact.jpg").write_bytes(b"y")
    workspace.purge_input(sid, settings)
    assert not (path / "input.mp4").exists()
    assert (path / "1_pre_contact.jpg").exists()


def test_sweep_expired(settings):
    old_id, old = workspace.create_session(settings)
    _, fresh = workspace.create_session(settings)
    foreign = settings.workspace_dir / "keep-me"
    foreign.mkdir()
    past = time.time() - 120
    os.utime(old, (past, past))
    os.utime(foreign, (past, past))

    assert workspace.sweep_expired(settings) == 1
    assert not old.exists() and fresh.exists() and foreign.exists()


def test_sweep_missing_root(tmp_path):
    assert workspace.sweep_expired(Settings(workspace_dir=tmp_path / "nope")) == 0


@pytest.mark.parametrize(
    "bad",
    [
        "../etc",
        "..\\..\\windows",
        "",
        "not-a-uuid",
        str(uuid.uuid1()),
        str(uuid.uuid4()).upper(),
        "{" + str(uuid.uuid4()) + "}",
        str(uuid.uuid4()).replace("-", ""),
        str(uuid.uuid4()) + "/../x",
    ],
)
def test_session_path_rejects_bad_ids(settings, bad):
    with pytest.raises(workspace.InvalidSessionId):
        workspace.session_path(bad, settings)
