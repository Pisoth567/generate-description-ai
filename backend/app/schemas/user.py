from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


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
    plan: str
    credits: int
    is_active: bool
    email_verified_at: datetime | None
    ui_language: Literal["en", "km"]
    google_linked: bool
    created_at: datetime
    updated_at: datetime


class CreditAdjustmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: int = Field(strict=True)
    reason: str | None = None

    @field_validator("amount")
    @classmethod
    def nonzero_amount(cls, value: int) -> int:
        if value == 0:
            raise ValueError("Amount must not be zero")
        return value


class CreditResponse(BaseModel):
    user_id: int
    previous_credits: int
    adjustment: int
    current_credits: int
