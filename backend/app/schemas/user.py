from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr | None = None

    @field_validator("email")
    @classmethod
    def reject_explicit_null(cls, value):
        if value is None:
            raise ValueError("Field cannot be null; omit it to leave it unchanged")
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    plan: str
    credits: int
    is_active: bool
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
