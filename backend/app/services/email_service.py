"""Transactional delivery boundary. Tests replace send_verification, never use a live provider."""
import httpx
from fastapi import HTTPException
from app.core.config import settings


def configured() -> None:
    secret = settings.EMAIL_VERIFICATION_SECRET
    if not secret or len(secret.get_secret_value().encode()) < 32:
        raise HTTPException(503, {"code": "email_configuration_required"})
    if settings.EMAIL_PROVIDER != "resend" or not settings.EMAIL_FROM or not settings.EMAIL_API_KEY:
        raise HTTPException(503, {"code": "email_configuration_required"})


def send_verification(email: str, code: str) -> None:
    configured()
    try:
        with httpx.Client(timeout=10, follow_redirects=False) as client:
            response = client.post("https://api.resend.com/emails", headers={
                "Authorization": "Bearer " + settings.EMAIL_API_KEY.get_secret_value(),
            }, json={"from": settings.EMAIL_FROM, "to": [email],
                     "subject": "Verify your email", "text": f"Your verification code is {code}. It expires in 10 minutes."})
            response.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(503, {"code": "email_delivery_unavailable"}) from None
