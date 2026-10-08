from fastapi import APIRouter

from app.api.deps import CurrentUser, Database
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserResponse
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, db: Database):
    return auth_service.register_user(db, data)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Database):
    return auth_service.login_user(db, data)


@router.get("/me", response_model=UserResponse)
def me(current_user: CurrentUser):
    return current_user
