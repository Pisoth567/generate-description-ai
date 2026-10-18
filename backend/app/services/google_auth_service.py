"""Google identity verification and explicit, non-merging account linking."""
from dataclasses import dataclass
from datetime import datetime, timezone
from hmac import compare_digest
import time

from fastapi import HTTPException
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from pydantic import EmailStr, TypeAdapter, ValidationError
import requests
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.services import auth_service, user_service


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    email_verified: bool


def verify_google_identity(token: str, nonce: str) -> GoogleIdentity:
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google sign-in is not currently available.")
    try:
        # The official verifier checks signature, audience, time and issuer.
        # Bound certificate-fetch time and close the transport after use.
        with requests.Session() as session:
            transport = Request(session=session)

            def request(*args, **kwargs):
                kwargs["timeout"] = 10
                return transport(*args, **kwargs)

            claims = id_token.verify_oauth2_token(
                token, request, audience=settings.GOOGLE_CLIENT_ID,
            )
        sub, email = claims.get("sub"), claims.get("email")
        signed_nonce = claims.get("nonce")
        if (
            claims.get("aud") != settings.GOOGLE_CLIENT_ID
            or claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com")
            or not isinstance(claims.get("exp"), (int, float))
            or claims["exp"] <= time.time()
            or claims.get("email_verified") is not True
            or not isinstance(sub, str) or not sub.strip() or len(sub) > 255
            or not isinstance(email, str) or not email.strip() or len(email) > 254
            or not isinstance(signed_nonce, str) or not nonce
            or not compare_digest(signed_nonce.encode(), nonce.encode())
        ):
            raise ValueError()
        email = str(TypeAdapter(EmailStr).validate_python(email))
        return GoogleIdentity(sub, user_service.normalize_email(email), True)
    except (ValueError, TypeError, GoogleAuthError, ValidationError, requests.RequestException):
        raise HTTPException(401, "Invalid Google sign-in", headers={"WWW-Authenticate": "Bearer"}) from None


def _by_sub(db: Session, sub: str) -> User | None:
    return db.scalar(select(User).where(User.google_sub == sub))


def _active(user: User) -> User:
    if not user.is_active:
        raise auth_service.InactiveAccount()
    return user


def _email_conflict(user: User) -> None:
    if user.google_sub is None:
        raise HTTPException(409, "An account with this email already exists. Sign in with your password first and link Google from your account.")
    raise HTTPException(409, "Google account cannot be used with this account.")


def authenticate_google_user(db: Session, identity: GoogleIdentity) -> User:
    with user_service.database_operation(db):
        user = _by_sub(db, identity.sub)
        if user is not None:
            return _active(user)
        existing = user_service.get_user_by_email(db, identity.email)
        if existing is not None:
            _email_conflict(existing)
        user = User(email=identity.email, google_sub=identity.sub, password_hash=None,
                    plan="free", credits=10, is_active=True, email_verified_at=datetime.now(timezone.utc))
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # A concurrent insert/link may have won either unique index. Never
            # merge by email or add credits to the winner.
            db.rollback()
            winner = _by_sub(db, identity.sub)
            if winner is not None:
                return _active(winner)
            existing = user_service.get_user_by_email(db, identity.email)
            if existing is not None:
                _email_conflict(existing)
            raise user_service.DatabaseFailure() from None
        db.refresh(user)
        return _active(user)


def link_google_user(db: Session, user_id: int, identity: GoogleIdentity) -> None:
    with user_service.database_operation(db):
        # Serialize competing links and refresh the current email/active state.
        user = _active(user_service.locked_user(db, user_id))
        if user_service.normalize_email(user.email) != identity.email:
            raise HTTPException(409, "Google email must match your account email.")
        owner = _by_sub(db, identity.sub)
        if (owner is not None and owner.id != user.id) or user.google_sub not in (None, identity.sub):
            raise HTTPException(409, "Google account cannot be linked to this account.")
        user.google_sub = identity.sub
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Google account cannot be linked to this account.") from None
