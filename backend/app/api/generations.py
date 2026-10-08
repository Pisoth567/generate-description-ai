from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import CurrentUser, Database
from app.schemas.generation import GenerationHistoryResponse
from app.services import generation_service

router = APIRouter(prefix="/api/generations", tags=["generation"])


@router.get("", response_model=list[GenerationHistoryResponse])
def history(current_user: CurrentUser, db: Database,
            skip: Annotated[int, Query(ge=0)] = 0,
            limit: Annotated[int, Query(ge=1, le=100)] = 20):
    return generation_service.list_user_generations(db, current_user.id, skip, limit)


@router.get("/{generation_id}", response_model=GenerationHistoryResponse)
def detail(generation_id: int, current_user: CurrentUser, db: Database):
    generation = generation_service.get_user_generation(db, current_user.id, generation_id)
    if generation is None:
        raise HTTPException(404, "Generation not found")
    return generation
