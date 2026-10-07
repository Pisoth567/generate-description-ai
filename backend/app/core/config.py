from pathlib import Path

from pydantic import SecretStr
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
    DATABASE_URL: SecretStr | None = None
    PAYWAY_MERCHANT_ID: SecretStr | None = None
    PAYWAY_API_KEY: SecretStr | None = None
    PAYWAY_ENV: str = "sandbox"


settings = Settings()
