from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict


class PaymentPackageCode(str, Enum):
    STARTER = "starter"
    VALUE = "value"
    PRO = "pro"


class PaymentPackageResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    code: PaymentPackageCode
    amount: Decimal
    currency: str
    credits: int


class PaymentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    package_code: PaymentPackageCode


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tran_id: str
    package_code: str
    amount: Decimal
    currency: str
    credits: int
    status: str
    bank_ref: str | None
    payment_type: str | None
    created_at: datetime
    paid_at: datetime | None


class QRCheckout(BaseModel):
    type: Literal["aba_qr"] = "aba_qr"
    qr_image: str
    aba_deeplink: str
    app_store_url: str | None = None
    play_store_url: str | None = None


class PaymentCheckoutResponse(BaseModel):
    payment: PaymentResponse
    checkout: QRCheckout
