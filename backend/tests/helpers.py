"""Test-only sender capture. Never returns codes from application HTTP endpoints."""
from unittest.mock import patch
from app.services import email_service


def verified_registration(client, credentials):
    with patch.object(email_service, "send_verification") as sender:
        response = client.post('/api/auth/register', json=credentials)
    if response.status_code == 201:
        verified = client.post('/api/auth/verify-email', json={
            'email': credentials['email'], 'code': sender.call_args.args[1]})
        if verified.status_code != 200:
            raise AssertionError('Test verification failed')
    return response
