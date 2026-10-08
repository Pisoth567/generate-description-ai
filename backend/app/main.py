from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.auth import router as auth_router
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
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(generate_router, prefix="/api")
app.include_router(health_router)
app.include_router(users_router)
app.include_router(auth_router)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc: RequestValidationError):
    # FastAPI normally echoes invalid inputs, which can include passwords.
    errors = [
        {key: error[key] for key in ("type", "loc", "msg")}
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Generate Description AI API is running"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
