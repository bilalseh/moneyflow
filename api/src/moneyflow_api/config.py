import logging
from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "production", "test"]

STRIPE_TEST_KEY_PREFIX = "sk_test_"

logger = logging.getLogger(__name__)


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
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    gemini_api_key: SecretStr = SecretStr("")
    gemini_model: str = Field(default="gemini-2.5-flash", pattern=r"^[A-Za-z0-9.\-]+$")
    gemini_timeout_seconds: float = Field(default=20.0, gt=0, le=120)

    stripe_secret_key: SecretStr = SecretStr("")
    stripe_webhook_secret: SecretStr = SecretStr("")
    app_url: str = Field(default="https://moneyflow-coach.web.app", pattern=r"^https?://\S+$")
    pro_price_cents: int = Field(default=500, gt=0)

    free_daily_ai: int = Field(default=20, ge=0)
    pro_daily_ai: int = Field(default=200, ge=0)

    @field_validator("app_url")
    @classmethod
    def _strip_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def ai_enabled(self) -> bool:
        return bool(self.gemini_api_key.get_secret_value().strip())

    @property
    def stripe_test_key(self) -> str | None:
        """The Stripe key, but only when it is a test-mode secret key."""
        key = self.stripe_secret_key.get_secret_value().strip()
        return key if key.startswith(STRIPE_TEST_KEY_PREFIX) else None

    @property
    def stripe_key_rejected(self) -> bool:
        """True when a Stripe key is set but is not a test key (live keys are never used)."""
        key = self.stripe_secret_key.get_secret_value().strip()
        return bool(key) and self.stripe_test_key is None

    @property
    def billing_enabled(self) -> bool:
        return self.stripe_test_key is not None

    @property
    def webhook_secret(self) -> str | None:
        secret = self.stripe_webhook_secret.get_secret_value().strip()
        return secret or None


def warn_about_rejected_keys(settings: Settings) -> None:
    if settings.stripe_key_rejected:
        logger.error(
            "MONEYFLOW_STRIPE_SECRET_KEY is not a test key (sk_test_...). "
            "It is ignored and billing stays disabled."
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
