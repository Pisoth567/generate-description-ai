from collections.abc import Iterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.user import (
    CreditAdjustmentRequest,
    CreditResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.services import user_service

router = APIRouter(prefix="/api/users", tags=["users"])


def user_database(db: Annotated[Session, Depends(get_db)]) -> Iterator[Session]:
    """Translate safe application errors consistently for all user endpoints."""
    try:
        yield db
    except user_service.UserServiceError as exc:
        if isinstance(exc, user_service.UserNotFound):
            code = status.HTTP_404_NOT_FOUND
        elif isinstance(exc, user_service.DuplicateEmail):
            code = status.HTTP_409_CONFLICT
        elif isinstance(exc, user_service.InvalidCreditAdjustment):
            code = status.HTTP_400_BAD_REQUEST
        else:
            code = status.HTTP_500_INTERNAL_SERVER_ERROR
        raise HTTPException(status_code=code, detail=str(exc)) from None


Database = Annotated[Session, Depends(user_database)]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, db: Database):
    return user_service.create_user(db, data)


@router.get("", response_model=list[UserResponse])
def list_users(
    db: Database,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    return user_service.list_users(db, skip, limit)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Database):
    return user_service.get_user(db, user_id)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, data: UserUpdate, db: Database):
    return user_service.update_user(db, user_id, data)


@router.delete("/{user_id}", response_model=UserResponse)
def delete_user(user_id: int, db: Database):
    return user_service.update_user(db, user_id, UserUpdate(is_active=False))


@router.post("/{user_id}/credits", response_model=CreditResponse)
def adjust_credits(user_id: int, data: CreditAdjustmentRequest, db: Database):
    return user_service.adjust_user_credits(db, user_id, data.amount)
