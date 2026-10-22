from fastapi import APIRouter

from app.api.deps import CurrentUser, Database
from app.schemas.user import AvatarUpdate, UserResponse
from app.services.user_service import database_operation

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.patch("/avatar", response_model=UserResponse)
def update_avatar(data: AvatarUpdate, current_user: CurrentUser, db: Database):
    with database_operation(db):
        current_user.avatar_id = data.avatar_id
        db.commit()
        db.refresh(current_user)
        return current_user
