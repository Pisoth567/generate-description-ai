from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr


class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ui_language: Literal["en", "km"]


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    is_active: bool
    email_verified_at: datetime | None
    ui_language: Literal["en", "km"]
    google_linked: bool
    created_at: datetime
    updated_at: datetime
