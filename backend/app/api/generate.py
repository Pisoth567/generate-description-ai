from fastapi import APIRouter, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from app.api.deps import CurrentUser, Database
from app.schemas.generation import GenerationRequest, GenerationResponse
from app.services import ai_service, generation_service, image_service, rate_limit_service

router = APIRouter(tags=["generation"])

def request_schema():
    schema = GenerationRequest.model_json_schema()
    definitions = schema.pop("$defs", {})
    def inline(value):
        if isinstance(value, dict):
            if "$ref" in value:
                return {**inline(definitions[value["$ref"].rsplit("/", 1)[1]]), **{k: v for k, v in value.items() if k != "$ref"}}
            return {k: inline(v) for k, v in value.items()}
        if isinstance(value, list):
            return [inline(v) for v in value]
        return value
    return inline(schema)



@router.post("/generate", response_model=GenerationResponse, openapi_extra={"requestBody": {
    "required": True, "content": {
        "application/json": {"schema": request_schema()},
        "multipart/form-data": {"schema": {"type": "object", "required": ["product_name", "features"], "properties": {
            **{key: {"type": "string"} for key in ["product_name", "category", "features", "tone"]},
            "language": {"type": "string", "enum": ["English", "Khmer"]},
            "image": {"type": "string", "format": "binary"}}}}}}})
async def generate(request: Request, current_user: CurrentUser, db: Database) -> GenerationResponse:
    image = None
    try:
        if request.headers.get("content-type", "").startswith("multipart/form-data"):
            async with request.form(max_files=1, max_fields=6, max_part_size=65536) as form:
                if len(form.multi_items()) != len(form):
                    raise HTTPException(422, "Duplicate fields are not allowed")
                fields = dict(form)
                upload = fields.pop("image", None)
                if upload is not None:
                    if not isinstance(upload, UploadFile):
                        raise HTTPException(422, "Invalid image")
                    image = await run_in_threadpool(image_service.validate_image,
                        await upload.read(image_service.MAX_IMAGE_BYTES + 1), upload.content_type, upload.filename or "")
                data = GenerationRequest.model_validate(fields)
        elif request.headers.get("content-type", "").startswith("application/json"):
            data = GenerationRequest.model_validate(await request.json())
        else:
            raise HTTPException(415, "Use JSON or multipart form data")
    except ValidationError as exc:
        raise RequestValidationError(exc.errors()) from None
    except ValueError:
        raise HTTPException(422, "Invalid request") from None
    user_id = current_user.id
    await run_in_threadpool(rate_limit_service.reserve, db, user_id)
    try:
        result = await ai_service.generate_product_description(data, image) if image else await ai_service.generate_product_description(data)
        return await run_in_threadpool(generation_service.finalize_generation, db, user_id, data, result)
    except ai_service.AIImageUnsupported:
        raise HTTPException(503, {"code": "image_model_unavailable"}) from None
    except ai_service.AIUnavailable:
        raise HTTPException(503, "AI service is temporarily unavailable") from None
