from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.generation import Generation
from app.schemas.generation import GenerationRequest, GenerationResponse
from app.services.ai_service import AIResult, AIUnavailable
from app.services.auth_service import InactiveAccount
from app.services.user_service import database_operation, locked_user


def finalize_generation(
    db: Session, user_id: int, request: GenerationRequest, result: AIResult,
) -> GenerationResponse:
    """Own a short transaction after AI completes; commit the history insert once."""
    if not result.description.strip():
        raise AIUnavailable()
    with database_operation(db):
        with db.begin():
            user = locked_user(db, user_id)
            if not user.is_active:
                raise InactiveAccount()
            generation = Generation(
                user_id=user_id, product_name=request.product_name,
                category=request.category, generated_text=result.description,
                tone=request.tone, language=request.language.value, tokens_used=result.tokens_used,
            )
            db.add(generation)
            db.flush()
            # Snapshot before commit expiration: no post-commit query/failure window.
            response = GenerationResponse(
                generation_id=generation.id, description=generation.generated_text,
                tone=generation.tone, language=generation.language,
                tokens_used=generation.tokens_used,
            )
        return response


def list_user_generations(db: Session, user_id: int, skip: int, limit: int) -> list[Generation]:
    with database_operation(db):
        return list(db.scalars(select(Generation).where(Generation.user_id == user_id)
            .order_by(Generation.created_at.desc(), Generation.id.desc()).offset(skip).limit(limit)))


def get_user_generation(db: Session, user_id: int, generation_id: int) -> Generation | None:
    with database_operation(db):
        return db.scalar(select(Generation).where(
            Generation.id == generation_id, Generation.user_id == user_id))
