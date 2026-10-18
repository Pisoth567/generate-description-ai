"""Validate and re-encode in memory; strip metadata and never persist images."""
import base64
from io import BytesIO
import warnings
from pathlib import PurePath
from PIL import Image, UnidentifiedImageError
from fastapi import HTTPException

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_PIXELS = MAX_IMAGE_BYTES // 4  # At most 5 MiB decoded RGBA pixels.
FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


def validate_image(data: bytes, content_type: str, filename: str = "") -> str:
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, {"code": "image_too_large"})
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as im:
                fmt = im.format
                if fmt not in FORMATS or FORMATS[fmt] != content_type:
                    raise ValueError()
                extensions = {"JPEG": {".jpg", ".jpeg"}, "PNG": {".png"}, "WEBP": {".webp"}}
                if filename and PurePath(filename).suffix.lower() not in extensions[fmt]:
                    raise ValueError()
                if im.width * im.height > MAX_PIXELS or getattr(im, "n_frames", 1) != 1:
                    raise ValueError()
                im.verify()
            with Image.open(BytesIO(data)) as im:
                im.load()
                clean = im.convert("RGB" if fmt == "JPEG" else "RGBA")
                output = BytesIO()
                clean.save(output, format=fmt)
                value = output.getvalue()
                if len(value) > MAX_IMAGE_BYTES:
                    raise ValueError()
        return f"data:{FORMATS[fmt]};base64," + base64.b64encode(value).decode("ascii")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombWarning, Image.DecompressionBombError):
        raise HTTPException(422, {"code": "invalid_image"}) from None
