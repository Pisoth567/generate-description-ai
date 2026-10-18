from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy import delete, func, select
from app.core.config import settings
from app.models.verification import GenerationAttempt
from app.services.user_service import database_operation, locked_user


def reserve(db, user_id):
    """READ COMMITTED + user row lock serializes count-and-insert across workers.

    Attempts commit BEFORE provider I/O, so failures also consume capacity.
    """
    with database_operation(db):
        user = locked_user(db, user_id)
        if not user.is_active or user.email_verified_at is None:
            raise HTTPException(403, "Account unavailable")
        # PostgreSQL clock after lock acquisition, not transaction start time.
        timestamp = db.scalar(select(func.clock_timestamp()))
        db.execute(delete(GenerationAttempt).where(GenerationAttempt.user_id == user_id,
            GenerationAttempt.created_at <= timestamp - timedelta(days=1)))
        def count(since):
            return db.scalar(select(func.count()).select_from(GenerationAttempt).where(
                GenerationAttempt.user_id == user_id, GenerationAttempt.created_at > since))
        if (count(timestamp - timedelta(minutes=1)) >= settings.GENERATION_RATE_LIMIT_PER_MINUTE
                or count(timestamp - timedelta(days=1)) >= settings.GENERATION_RATE_LIMIT_PER_DAY):
            raise HTTPException(429, "Please wait a little before generating again.")
        db.add(GenerationAttempt(user_id=user_id, created_at=timestamp))
        db.commit()
