"""Trusted catalog and atomic payment accounting; no network calls here."""
from datetime import datetime, timezone
from decimal import Decimal
import secrets
from types import MappingProxyType

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.payment import Payment
from app.schemas.payment import PaymentPackageCode, PaymentPackageResponse, PaymentResponse
from app.services import payway_service
from app.services.user_service import DatabaseFailure, database_operation, locked_user

PACKAGES = MappingProxyType({
    code: PaymentPackageResponse(code=code, amount=Decimal(amount), currency="USD", credits=credits)
    for code, amount, credits in (
        (PaymentPackageCode.STARTER, "1.99", 100),
        (PaymentPackageCode.VALUE, "4.99", 500),
        (PaymentPackageCode.PRO, "9.99", 1500),
    )
})


class PaymentNotFound(Exception):
    pass


class PaymentMismatch(Exception):
    pass


class CreditBalanceLimit(Exception):
    pass


def new_tran_id() -> str:
    # 80 random bits, 20 alphanumeric characters; DB uniqueness is authoritative.
    return secrets.token_hex(10)


def create_payment(db: Session, user_id: int, code: PaymentPackageCode) -> PaymentResponse:
    package = PACKAGES[code]
    with database_operation(db):
        for _ in range(3):
            try:
                with db.begin():
                    payment = Payment(user_id=user_id, tran_id=new_tran_id(), package_code=package.code.value,
                                      amount=package.amount, currency=package.currency, credits=package.credits,
                                      provider="aba_payway", status="pending")
                    db.add(payment)
                    db.flush()
                    payway_service.build_purchase_fields(payment.tran_id, payment.amount,
                                                         payment.currency, payment.id)
                    payway_service.purchase_url()  # Validate configuration before committing.
                    response = PaymentResponse.model_validate(payment)
                return response
            except IntegrityError as exc:
                diag = getattr(exc.orig, "diag", None)
                if (getattr(exc.orig, "sqlstate", None) != "23505"
                        or getattr(diag, "constraint_name", None) != "ix_payments_tran_id"):
                    raise
                # begin() rolled back the failed insert; only an ID collision retries.
        raise DatabaseFailure()


def get_payment(db: Session, *, user_id: int | None = None, payment_id: int | None = None,
                tran_id: str | None = None) -> PaymentResponse:
    with database_operation(db):
        statement = select(Payment)
        if payment_id is not None:
            statement = statement.where(Payment.id == payment_id)
        elif tran_id is not None:
            statement = statement.where(Payment.tran_id == tran_id)
        else:
            raise PaymentNotFound()
        if user_id is not None:
            statement = statement.where(Payment.user_id == user_id)
        payment = db.scalar(statement)
        if payment is None:
            raise PaymentNotFound()
        result = PaymentResponse.model_validate(payment)
        # No transaction/connection held while awaiting provider verification.
        db.rollback()
        return result


def list_payments(db: Session, user_id: int, skip: int, limit: int) -> list[PaymentResponse]:
    with database_operation(db):
        return [PaymentResponse.model_validate(row) for row in db.scalars(
            select(Payment).where(Payment.user_id == user_id)
            .order_by(Payment.created_at.desc(), Payment.id.desc()).offset(skip).limit(limit))]


def finalize_approved_payment(db: Session, tran_id: str, result: payway_service.TransactionResult,
                              callback_metadata: dict | None = None) -> PaymentResponse:
    """Serialize callbacks AND manual verification on the same payment row.

    callback_metadata must come only from an HMAC-verified callback. It supplies
    optional receipt metadata, never the amount, status, user or credit count.
    """
    with database_operation(db):
        with db.begin():
            payment = db.scalar(select(Payment).where(Payment.tran_id == tran_id).with_for_update()
                                .execution_options(populate_existing=True))
            if payment is None:
                raise PaymentNotFound()
            if result.tran_id != payment.tran_id or payment.provider != "aba_payway":
                raise PaymentMismatch()
            if payment.credited_at is not None:
                return PaymentResponse.model_validate(payment)
            if result.approved:
                if (not isinstance(result.amount, Decimal) or not result.amount.is_finite()
                        or result.amount != payment.amount or result.currency != payment.currency):
                    raise PaymentMismatch()
                if payment.status not in ("pending", "failed", "cancelled") or payment.credits <= 0:
                    raise PaymentMismatch()
                user = locked_user(db, payment.user_id)
                if user.credits + payment.credits > 2_147_483_647:
                    raise CreditBalanceLimit()
                user.credits += payment.credits
                payment.status = "paid"
                now = datetime.now(timezone.utc)
                payment.paid_at = now
                payment.credited_at = now
                metadata = callback_metadata or {}
                for name in ("bank_ref", "apv", "payment_type"):
                    setattr(payment, name, payway_service.safe_metadata(getattr(result, name))
                            or payway_service.safe_metadata(metadata.get(name)))
            elif (result.status_code, result.status) == (3, "DECLINED"):
                payment.status = "failed"
            elif (result.status_code, result.status) == (7, "CANCELLED"):
                payment.status = "cancelled"
            # Pending/unknown/pre-auth/refunded states never grant credits.
            db.flush()
            response = PaymentResponse.model_validate(payment)
        return response
