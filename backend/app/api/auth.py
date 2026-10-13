from fastapi import APIRouter

from app.api.deps import CurrentUser, Database
from app.schemas.auth import GoogleAuthRequest, GoogleLinkResponse, LoginRequest, RegisterRequest, TokenResponse
from app.core.security import create_access_token
from app.schemas.user import UserResponse
from app.services import auth_service, google_auth_service

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


@router.post("/google", response_model=TokenResponse)
def google_login(data: GoogleAuthRequest, db: Database):
    identity = google_auth_service.verify_google_identity(data.id_token, data.nonce)
    user = google_auth_service.authenticate_google_user(db, identity)
    token, expires_in = create_access_token(user.id)
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.post("/google/link", response_model=GoogleLinkResponse)
def google_link(data: GoogleAuthRequest, current_user: CurrentUser, db: Database):
    identity = google_auth_service.verify_google_identity(data.id_token, data.nonce)
    google_auth_service.link_google_user(db, current_user.id, identity)
    return GoogleLinkResponse()
