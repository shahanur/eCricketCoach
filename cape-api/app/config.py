from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CAPE_", env_file=".env", extra="ignore")

    workspace_dir: Path = Path("cricket_workspace")
    weights_dir: Path = Path("weights")
    device: Literal["cuda", "cpu"] = "cuda"
    max_upload_mb: int = Field(500, gt=0)
    artifact_ttl_seconds: int = Field(900, gt=0)
    sweep_interval_seconds: int = Field(60, gt=0)
    api_key: SecretStr | None = None

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
