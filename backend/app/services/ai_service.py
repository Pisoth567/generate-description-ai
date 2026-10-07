from app.schemas.generation import GenerationRequest


def generate_description(request: GenerationRequest) -> str:
    """Generate deterministic mock copy; tone and language are metadata only."""
    category = f" {request.category}" if request.category else ""
    description = f"{request.product_name} is a high-quality{category} product"

    if request.features:
        if len(request.features) == 1:
            features = request.features[0]
        elif len(request.features) == 2:
            features = " and ".join(request.features)
        else:
            features = f"{', '.join(request.features[:-1])}, and {request.features[-1]}"
        description += f" featuring {features}"

    return f"{description}."
