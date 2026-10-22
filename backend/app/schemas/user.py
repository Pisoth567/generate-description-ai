from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.core.avatars import ALLOWED_AVATAR_IDS


class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ui_language: Literal["en", "km"]


class AvatarUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    avatar_id: str | None

    @field_validator("avatar_id")
    @classmethod
    def allowed_avatar(cls, value: str | None) -> str | None:
        if value is not None and value not in ALLOWED_AVATAR_IDS:
            raise ValueError("Choose a built-in avatar")
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    avatar_id: str | None
    email: EmailStr
    is_active: bool
    email_verified_at: datetime | None
    ui_language: Literal["en", "km"]
    google_linked: bool
    created_at: datetime
    updated_at: datetime
