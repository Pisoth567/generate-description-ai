"""SMTP boundary; sync FastAPI auth routes execute this in the worker threadpool."""
from email.message import EmailMessage
from html import escape
import smtplib
import ssl

from fastapi import HTTPException
from app.core.config import settings


def configured() -> None:
    secret = settings.EMAIL_VERIFICATION_SECRET
    if (not secret or len(secret.get_secret_value().encode()) < 32
            or settings.EMAIL_PROVIDER != "smtp" or not settings.EMAIL_FROM.strip()
            or not settings.SMTP_HOST.strip() or not settings.SMTP_USERNAME.strip()
            or not settings.SMTP_PASSWORD or not settings.SMTP_PASSWORD.get_secret_value()
            or any(c in settings.EMAIL_FROM for c in "\r\n")):
        raise HTTPException(503, {"code": "email_configuration_required"})


def send_verification(email: str, code: str) -> None:
    configured()
    message = EmailMessage()
    message["Subject"] = "Verify your email"
    message["From"] = settings.EMAIL_FROM
    message["To"] = email
    message.set_content(
        f"Generate Description AI\n\nYour verification code is {code}.\n"
        "It expires in 10 minutes.\n\n"
        "If you did not register, ignore this email. Do not share this code."
    )
    message.add_alternative(
        f"<h1>Verify your email</h1><p>Generate Description AI</p>"
        f"<p>Your verification code is <strong>{escape(code)}</strong>.</p>"
        "<p>It expires in 10 minutes.</p>"
        "<p>If you did not register, ignore this email. Do not share this code.</p>",
        subtype="html",
    )
    try:
        context = ssl.create_default_context()
        # True means mandatory STARTTLS; False means implicit TLS (normally 465).
        # Neither configuration permits cleartext authentication or fallback.
        transport = smtplib.SMTP if settings.SMTP_USE_TLS else smtplib.SMTP_SSL
        options = {} if settings.SMTP_USE_TLS else {"context": context}
        with transport(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10, **options) as client:
            if settings.SMTP_USE_TLS:
                client.ehlo()
                client.starttls(context=context)
                client.ehlo()
            client.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD.get_secret_value())
            refused = client.send_message(message)
            if refused:
                raise smtplib.SMTPException("Recipient unavailable")
    except (smtplib.SMTPException, OSError, ValueError):
        raise HTTPException(503, {"code": "email_delivery_unavailable"}) from None
