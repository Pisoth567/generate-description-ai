from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

NonEmptyString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
ProductName = Annotated[NonEmptyString, StringConstraints(max_length=200)]
Category = Annotated[NonEmptyString, StringConstraints(max_length=100)]
Feature = Annotated[NonEmptyString, StringConstraints(max_length=300)]
Style = Annotated[NonEmptyString, StringConstraints(max_length=50)]


class GenerationLanguage(str, Enum):
    ENGLISH = "English"
    KHMER = "Khmer"


class GenerationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_name: ProductName
    category: Category | None = None
    features: Annotated[list[Feature], Field(max_length=20)] | Annotated[str, StringConstraints(min_length=1, max_length=6000)]
    @field_validator("features")
    @classmethod
    def require_details(cls, value):
        if isinstance(value, str) and not value.strip():
            raise ValueError("Product details cannot be blank")
        return value

    tone: Style = "professional"
    language: GenerationLanguage = GenerationLanguage.ENGLISH


class GenerationResponse(BaseModel):
    generation_id: int
    description: NonEmptyString
    tone: str
    language: str
    tokens_used: int


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
