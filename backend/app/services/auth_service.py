from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token, hash_password, verify_dummy_password, verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services import user_service


class InvalidCredentials(Exception):
    pass


class InactiveAccount(Exception):
    pass


def register_user(db: Session, data: RegisterRequest) -> User:
    with user_service.database_operation(db):
        email = user_service.normalize_email(str(data.email))
        if user_service.get_user_by_email(db, email) is not None:
            raise user_service.DuplicateEmail()
        user = User(
            email=email, password_hash=hash_password(data.password),
            plan="free", credits=10, is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = user_service.get_user_by_email(db, email)
    if user is None or user.password_hash is None:
        verify_dummy_password(password)
        raise InvalidCredentials()
    if not verify_password(password, user.password_hash):
        raise InvalidCredentials()
    if not user.is_active:
        raise InactiveAccount()
    return user


def login_user(db: Session, data: LoginRequest) -> TokenResponse:
    user = authenticate_user(db, str(data.email), data.password)
    token, expires_in = create_access_token(user.id)
    return TokenResponse(access_token=token, expires_in=expires_in)
