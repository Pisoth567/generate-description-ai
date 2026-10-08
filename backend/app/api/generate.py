from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from app.api.deps import CurrentUser, Database
from app.core.config import settings
from app.schemas.generation import GenerationRequest, GenerationResponse
from app.services import ai_service, generation_service
from app.services.user_service import database_operation

router = APIRouter(tags=["generation"])


@router.post("/generate", response_model=GenerationResponse)
async def generate(request: GenerationRequest, current_user: CurrentUser, db: Database) -> GenerationResponse:
    user_id = current_user.id
    cost = settings.generation_credit_cost
    if current_user.credits < cost:
        raise HTTPException(402, "Insufficient credits")
    # Release the authentication read transaction/connection before network I/O.
    with database_operation(db):
        await run_in_threadpool(db.rollback)
    try:
        result = await ai_service.generate_product_description(request)
        return await run_in_threadpool(
            generation_service.finalize_generation, db, user_id, request, result, cost,
        )
    except ai_service.AIUnavailable:
        raise HTTPException(503, "AI service is temporarily unavailable") from None
    except generation_service.InsufficientCredits:
        raise HTTPException(402, "Insufficient credits") from None
