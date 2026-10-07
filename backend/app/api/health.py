from fastapi import APIRouter, HTTPException, status

from app.db.database import test_database_connection

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/database")
def database_health() -> dict[str, str]:
    try:
        if test_database_connection() != 1:
            raise RuntimeError("Unexpected database health result")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        ) from None

    return {"status": "ok", "database": "connected"}
