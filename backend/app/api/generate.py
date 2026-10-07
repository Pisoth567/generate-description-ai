from fastapi import APIRouter

from app.schemas.generation import GenerationRequest, GenerationResponse
from app.services.ai_service import generate_description

router = APIRouter(tags=["generation"])


@router.post("/generate", response_model=GenerationResponse)
def generate(request: GenerationRequest) -> GenerationResponse:
    return GenerationResponse(
        description=generate_description(request),
        tone=request.tone,
        language=request.language,
    )
