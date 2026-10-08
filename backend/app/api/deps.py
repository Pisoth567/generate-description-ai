from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import InvalidAccessToken, decode_access_token
from app.db.database import get_db
from app.models.user import User
from app.services import auth_service, user_service

bearer = HTTPBearer(auto_error=False)


def unauthorized(detail: str = "Invalid or missing access token") -> HTTPException:
    return HTTPException(401, detail, headers={"WWW-Authenticate": "Bearer"})


def user_database(db: Annotated[Session, Depends(get_db)]) -> Iterator[Session]:
    """Translate application errors without exposing database or crypto details."""
    try:
        yield db
    except auth_service.InvalidCredentials:
        raise unauthorized("Invalid email or password") from None
    except auth_service.InactiveAccount:
        raise HTTPException(403, "Account is inactive") from None
    except user_service.UserServiceError as exc:
        if isinstance(exc, user_service.UserNotFound):
            code = 404
        elif isinstance(exc, user_service.DuplicateEmail):
            code = 409
        elif isinstance(exc, user_service.InvalidCreditAdjustment):
            code = 400
        else:
            code = 500
        raise HTTPException(code, str(exc)) from None


Database = Annotated[Session, Depends(user_database)]


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Database,
) -> User:
    if credentials is None:
        raise unauthorized()
    try:
        user_id = decode_access_token(credentials.credentials)
        user = user_service.get_user(db, user_id)
    except (InvalidAccessToken, user_service.UserNotFound):
        raise unauthorized() from None
    if not user.is_active:
        raise HTTPException(403, "Account is inactive")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_owned_user(user_id: int, current_user: CurrentUser) -> User:
    if user_id != current_user.id:
        raise HTTPException(403, "Access denied")
    return current_user


OwnedUser = Annotated[User, Depends(get_owned_user)]
