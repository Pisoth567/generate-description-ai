from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    PAYMENTS_ENABLED: bool = False
    EMAIL_PROVIDER: str = ""
    EMAIL_FROM: str = ""
    EMAIL_VERIFICATION_SECRET: SecretStr | None = Field(default=None, repr=False)
    EMAIL_API_KEY: SecretStr | None = Field(default=None, repr=False)
    GENERATION_RATE_LIMIT_PER_MINUTE: int = Field(default=5, gt=0)
    GENERATION_RATE_LIMIT_PER_DAY: int = Field(default=50, gt=0)
    APP_NAME: str = "Generate Description AI API"
    APP_ENV: str = "development"
    GOOGLE_CLIENT_ID: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    openai_api_key: SecretStr | None = Field(default=None, repr=False)
    openai_model: str = ""
    openai_max_output_tokens: int = Field(default=600, gt=0, le=4096)
    openai_timeout_seconds: float = Field(default=30, gt=0, le=120)
    generation_credit_cost: int = Field(default=1, gt=0, le=2_147_483_647)
    database_url: str = Field(repr=False)
    jwt_secret_key: SecretStr = Field(repr=False)
    jwt_algorithm: Literal["HS256"] = "HS256"
    access_token_expire_minutes: int = Field(default=30, gt=0)
    PAYWAY_MERCHANT_ID: SecretStr | None = Field(default=None, repr=False)
    PAYWAY_API_KEY: SecretStr | None = Field(default=None, repr=False)
    PAYWAY_ENV: Literal["sandbox"] = "sandbox"
    PAYWAY_API_URL: str = "https://checkout-sandbox.payway.com.kh"
    PAYWAY_RETURN_URL: str = ""
    PAYWAY_CONTINUE_SUCCESS_URL: str = ""
    PAYWAY_CANCEL_URL: str = ""
    PAYWAY_TIMEOUT_SECONDS: float = Field(default=15, gt=0, le=120)

    @field_validator("FRONTEND_URL")
    @classmethod
    def require_frontend_origin(cls, value: str) -> str:
        url = urlsplit(value)
        local = url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1"}
        if (not url.hostname or (url.scheme != "https" and not local)
                or url.username is not None or url.password is not None
                or url.path not in {"", "/"} or url.query or url.fragment
                or "*" in value or any(char.isspace() for char in value)):
            raise ValueError("FRONTEND_URL must be one HTTPS origin or a local HTTP origin")
        # Accessing port also rejects malformed ports before middleware startup.
        _ = url.port
        return value.rstrip("/")

    @field_validator("jwt_secret_key")
    @classmethod
    def require_strong_secret(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value().encode("utf-8")) < 32:
            raise ValueError("JWT_SECRET_KEY must contain at least 32 bytes")
        return value

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        # SQLAlchemy defaults to psycopg2 for bare PostgreSQL URLs.
        # Select Psycopg 3 without modifying the local environment file.
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value


settings = Settings()
