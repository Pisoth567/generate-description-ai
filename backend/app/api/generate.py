from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool
from app.api.deps import CurrentUser, Database
from app.schemas.generation import GenerationRequest, GenerationResponse
from app.services import ai_service, generation_service, rate_limit_service

router = APIRouter(tags=["generation"])


@router.post("/generate", response_model=GenerationResponse)
async def generate(data: GenerationRequest, current_user: CurrentUser, db: Database) -> GenerationResponse:
    user_id = current_user.id
    await run_in_threadpool(rate_limit_service.reserve, db, user_id)
    try:
        result = await ai_service.generate_product_description(data)
        return await run_in_threadpool(generation_service.finalize_generation, db, user_id, data, result)
    except ai_service.AIUnavailable:
        raise HTTPException(503, "AI service is temporarily unavailable") from None
