"""One current challenge per account, serialized with the parent user row lock."""
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
from fastapi import HTTPException
from sqlalchemy import select
from app.core.config import settings
from app.models.user import User
from app.models.verification import EmailVerificationCode
from app.services import email_service
from app.services.user_service import database_operation, normalize_email


def now():
    return datetime.now(timezone.utc)


def digest(user_id: int, code: str) -> str:
    secret = settings.EMAIL_VERIFICATION_SECRET
    if not secret or len(secret.get_secret_value().encode()) < 32:
        raise HTTPException(503, {"code": "email_configuration_required"})
    return hmac.new(secret.get_secret_value().encode(), f"{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


def issue(db, user):
    timestamp = now()
    row = db.scalar(select(EmailVerificationCode).where(EmailVerificationCode.user_id == user.id))
    if row and row.created_at + timedelta(seconds=60) > timestamp:
        return
    code = f"{secrets.randbelow(1000000):06d}"
    if row is None:
        row = EmailVerificationCode(user_id=user.id)
        db.add(row)
    row.code_digest = digest(user.id, code)
    row.created_at = timestamp
    row.expires_at = timestamp + timedelta(minutes=10)
    row.attempts = 0
    row.consumed_at = None
    db.flush()
    email_service.send_verification(user.email, code)


def resend(db, email):
    with database_operation(db):
        user = db.scalar(select(User).where(User.email == normalize_email(email)).with_for_update())
        if user and user.is_active and user.email_verified_at is None:
            issue(db, user)
        db.commit()
    # Same response for unknown, verified, inactive, and cooldown accounts.
    return {"ok": True}


def verify(db, email, code):
    with database_operation(db):
        user = db.scalar(select(User).where(User.email == normalize_email(email)).with_for_update())
        row = db.scalar(select(EmailVerificationCode).where(EmailVerificationCode.user_id == user.id)) if user else None
        timestamp = now()
        valid = False
        if user and user.is_active and row and row.consumed_at is None and row.expires_at > timestamp and row.attempts < 5:
            row.attempts += 1
            valid = hmac.compare_digest(row.code_digest, digest(user.id, code))
            if valid:
                row.consumed_at = timestamp
                user.email_verified_at = timestamp
        db.commit()  # Persist failed attempts before returning an error.
    if not valid:
        raise HTTPException(400, {"code": "invalid_verification_code"})
    return {"ok": True}
