from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_payments_positive_amount"),
        CheckConstraint("credits > 0", name="ck_payments_positive_credits"),
        CheckConstraint("status IN ('pending', 'paid', 'failed', 'cancelled')", name="ck_payments_status"),
        CheckConstraint("(status = 'paid') = (credited_at IS NOT NULL)", name="ck_payments_credited_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    tran_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    provider: Mapped[str] = mapped_column(String, default="aba_payway", server_default="aba_payway")
    package_code: Mapped[str] = mapped_column(String)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String, default="USD", server_default="USD")
    credits: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, default="pending", server_default="pending")
    bank_ref: Mapped[str | None] = mapped_column(String)
    apv: Mapped[str | None] = mapped_column(String)
    payment_type: Mapped[str | None] = mapped_column(String)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    credited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped[User] = relationship(back_populates="payments")
