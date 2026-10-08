from fastapi import APIRouter

from app.api.deps import Database, OwnedUser
from app.schemas.user import UserResponse, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user: OwnedUser):
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(data: UserUpdate, user: OwnedUser, db: Database):
    return user_service.update_user(db, user.id, data)


@router.delete("/{user_id}", response_model=UserResponse)
def delete_user(user: OwnedUser, db: Database):
    return user_service.deactivate_user(db, user.id)
