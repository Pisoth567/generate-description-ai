from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

NonEmptyString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
ProductName = Annotated[NonEmptyString, StringConstraints(max_length=200)]
Category = Annotated[NonEmptyString, StringConstraints(max_length=100)]
Feature = Annotated[NonEmptyString, StringConstraints(max_length=300)]
Style = Annotated[NonEmptyString, StringConstraints(max_length=50)]


class GenerationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_name: ProductName
    category: Category | None = None
    features: list[Feature] = Field(max_length=20)
    tone: Style = "professional"
    language: Style = "English"


class GenerationResponse(BaseModel):
    generation_id: int
    description: NonEmptyString
    tone: str
    language: str
    tokens_used: int
    credits_used: int
    credits_remaining: int


class GenerationHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_name: str
    category: str | None
    generated_text: str
    tone: str
    language: str
    tokens_used: int
    created_at: datetime
