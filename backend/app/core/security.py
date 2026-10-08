from datetime import datetime, timedelta, timezone
import secrets

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.core.config import settings

password_hasher = PasswordHash.recommended()
# Unknown emails and legacy accounts still perform an Argon2 verification.
_dummy_hash = password_hasher.hash(secrets.token_urlsafe(32))


class InvalidAccessToken(Exception):
    pass


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(plain_password, password_hash)
    except (UnknownHashError, ValueError):
        return False


def verify_dummy_password(password: str) -> None:
    verify_password(password, _dummy_hash)


def create_access_token(user_id: int) -> tuple[str, int]:
    now = datetime.now(timezone.utc)
    expires_in = settings.access_token_expire_minutes * 60
    token = jwt.encode(
        {"sub": str(user_id), "iat": now,
         "exp": now + timedelta(seconds=expires_in), "type": "access"},
        settings.jwt_secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )
    return token, expires_in


def decode_access_token(token: str) -> int:
    """Return the validated user ID; never select algorithms from the token."""
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret_key.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "iat", "exp", "type"]},
        )
        subject = claims["sub"]
        if claims["type"] != "access" or not isinstance(subject, str):
            raise InvalidAccessToken()
        # Reject invalid or oversized IDs before querying PostgreSQL INTEGERs.
        if not subject.isascii() or not subject.isdecimal() or len(subject) > 10:
            raise InvalidAccessToken()
        user_id = int(subject)
        if not 1 <= user_id <= 2_147_483_647:
            raise InvalidAccessToken()
        return user_id
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
        raise InvalidAccessToken() from None
