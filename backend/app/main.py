from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.generate import router as generate_router
from app.api.health import router as health_router
from app.api.users import router as users_router
from app.core.config import settings

app = FastAPI(title=settings.APP_NAME, version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)
app.include_router(generate_router, prefix="/api")
app.include_router(health_router)
app.include_router(users_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Generate Description AI API is running"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
