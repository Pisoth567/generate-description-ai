from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Generate Description AI API"
    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    OPENAI_API_KEY: SecretStr | None = None
    database_url: str = Field(repr=False)
    PAYWAY_MERCHANT_ID: SecretStr | None = None
    PAYWAY_API_KEY: SecretStr | None = None
    PAYWAY_ENV: str = "sandbox"

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        # SQLAlchemy defaults to psycopg2 for bare PostgreSQL URLs.
        # Select Psycopg 3 without modifying the local environment file.
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value


settings = Settings()
