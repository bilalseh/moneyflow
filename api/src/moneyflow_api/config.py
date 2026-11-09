from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "production", "test"]


class Settings(BaseSettings):
    """Runtime configuration, loaded from environment variables prefixed MONEYFLOW_."""

    model_config = SettingsConfigDict(
        env_prefix="MONEYFLOW_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: Environment = "development"
    firebase_project_id: str = "moneyflow-coach"
    gemini_api_key: SecretStr = SecretStr("")
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
