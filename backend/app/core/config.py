from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    APP_NAME: str = "Generate Description AI API"
    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    OPENAI_API_KEY: SecretStr | None = None
    database_url: str = Field(repr=False)
    jwt_secret_key: SecretStr = Field(repr=False)
    jwt_algorithm: Literal["HS256"] = "HS256"
    access_token_expire_minutes: int = Field(default=30, gt=0)
    PAYWAY_MERCHANT_ID: SecretStr | None = None
    PAYWAY_API_KEY: SecretStr | None = None
    PAYWAY_ENV: str = "sandbox"

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
