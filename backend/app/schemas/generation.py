from typing import Annotated

from pydantic import BaseModel, StringConstraints

NonEmptyString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class GenerationRequest(BaseModel):
    product_name: NonEmptyString
    category: NonEmptyString | None = None
    features: list[NonEmptyString]
    tone: NonEmptyString = "professional"
    language: NonEmptyString = "English"


class GenerationResponse(BaseModel):
    description: NonEmptyString
    tone: NonEmptyString
    language: NonEmptyString
