"""Phase 1 tests: real isolated PostgreSQL, mocked external boundaries."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.core.config import settings
from app.db.database import SessionLocal
from app.models.user import User
from app.models.generation import Generation
from app.models.verification import EmailVerificationCode, GenerationAttempt
from app.services import ai_service, email_service, verification_service
from app.schemas.generation import GenerationRequest
from helpers import verified_registration

class Phase1Tests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app); self.addCleanup(self.client.close)
        self.credentials = {'email': f'phase1-{uuid4().hex}@example.com', 'password': 'test-only-password-123'}
        sender = patch.object(email_service, 'send_verification')
        self.sender = sender.start(); self.addCleanup(sender.stop)
        ai = patch.object(ai_service, 'generate_product_description', new_callable=AsyncMock)
        self.ai = ai.start(); self.addCleanup(ai.stop)
        self.ai.return_value = ai_service.AIResult('A natural description.', 20)
        self.registration = self.client.post('/api/auth/register', json=self.credentials)
        self.assertEqual(self.registration.status_code, 201)
        self.user_id = self.registration.json()['id']; self.code = self.sender.call_args.args[1]
        self.payload = {'product_name': 'Product', 'features': 'Known details\nSecond line', 'language': 'Khmer'}

    def verify(self, code=None):
        return self.client.post('/api/auth/verify-email', json={'email': self.credentials['email'], 'code': self.code if code is None else code})

    def login(self):
        self.assertEqual(self.verify().status_code, 200)
        response = self.client.post('/api/auth/login', json=self.credentials)
        self.assertEqual(response.status_code, 200)
        return {'Authorization': 'Bearer ' + response.json()['access_token']}

    def generate(self, headers):
        return self.client.post('/api/generate', json=self.payload, headers=headers)

    def challenge(self, db):
        return db.scalar(select(EmailVerificationCode).where(EmailVerificationCode.user_id == self.user_id))

    def test_registration_verification_login_consumption(self):
        self.assertIsNone(self.registration.json()['email_verified_at'])
        self.assertNotIn(self.code, self.registration.text)
        self.assertRegex(self.code, r'^[0-9]{6}$')
        with SessionLocal() as db:
            self.assertNotEqual(self.challenge(db).code_digest, self.code)
            self.assertEqual(len(self.challenge(db).code_digest), 64)
        self.assertEqual(self.client.post('/api/auth/login', json=self.credentials).status_code, 403)
        self.login(); self.assertEqual(self.verify().status_code, 400)

    def test_wrong_attempt_limit_expiration(self):
        wrong = '000000' if self.code != '000000' else '111111'
        for _ in range(5): self.assertEqual(self.verify(wrong).status_code, 400)
        self.assertEqual(self.verify().status_code, 400)
        with SessionLocal() as db:
            row = self.challenge(db); self.assertEqual(row.attempts, 5)
            row.attempts = 0; row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1); db.commit()
        self.assertEqual(self.verify().status_code, 400)

    def test_resend_cooldown_replacement_unknown(self):
        request = {'email': self.credentials['email']}
        response = self.client.post('/api/auth/resend-verification', json=request)
        self.assertEqual(response.status_code, 200); self.assertEqual(self.sender.call_count, 1)
        with SessionLocal() as db:
            self.challenge(db).created_at -= timedelta(seconds=61); db.commit()
        with patch.object(verification_service.secrets, 'randbelow', return_value=(int(self.code) + 1) % 1000000):
            self.client.post('/api/auth/resend-verification', json=request)
        self.assertEqual(self.sender.call_count, 2)
        self.assertEqual(self.verify().status_code, 400)
        self.assertEqual(self.verify(self.sender.call_args.args[1]).status_code, 200)
        unknown = self.client.post('/api/auth/resend-verification', json={'email': 'unknown@example.com'})
        self.assertEqual(response.json(), unknown.json())

    def test_inactive_and_missing_provider(self):
        with SessionLocal() as db:
            db.get(User, self.user_id).is_active = False; db.commit()
        self.assertEqual(self.verify().status_code, 400)
        self.assertEqual(self.client.post('/api/auth/login', json=self.credentials).status_code, 403)
        with patch.object(settings, 'EMAIL_PROVIDER', ''):
            from fastapi import HTTPException
            with self.assertRaises(HTTPException): email_service.configured()

    def test_concurrent_verification_consumes_code_once(self):
        barrier = Barrier(4)
        def call(_):
            barrier.wait(timeout=10)
            with TestClient(app) as client:
                return client.post('/api/auth/verify-email', json={
                    'email': self.credentials['email'], 'code': self.code}).status_code
        with ThreadPoolExecutor(max_workers=4) as pool:
            statuses = list(pool.map(call, range(4)))
        self.assertCountEqual(statuses, [200, 400, 400, 400])

    def test_failed_delivery_rolls_back_registration_and_resend(self):
        from fastapi import HTTPException
        self.sender.side_effect = HTTPException(503, {'code': 'email_delivery_unavailable'})
        credentials = {**self.credentials, 'email': f'failed-{uuid4().hex}@example.com'}
        self.assertEqual(self.client.post('/api/auth/register', json=credentials).status_code, 503)
        with SessionLocal() as db:
            self.assertIsNone(db.scalar(select(User).where(User.email == credentials['email'])))
            row = self.challenge(db)
            row.created_at -= timedelta(seconds=61)
            original_digest = row.code_digest
            db.commit()
        self.assertEqual(self.client.post('/api/auth/resend-verification', json={
            'email': self.credentials['email']}).status_code, 503)
        with SessionLocal() as db:
            self.assertEqual(self.challenge(db).code_digest, original_digest)
        self.assertEqual(self.verify().status_code, 200)

    def test_unverified_token_cannot_generate(self):
        from app.core.security import create_access_token
        token, _ = create_access_token(self.user_id)
        self.assertEqual(self.generate({'Authorization': 'Bearer ' + token}).status_code, 403)
        self.ai.assert_not_called()

    def test_invalid_multipart_and_actual_body_limit_do_not_call_ai(self):
        headers = self.login()
        response = self.client.post('/api/generate', headers=headers, files=[
            ('product_name', (None, 'One')), ('product_name', (None, 'Two')),
            ('features', (None, 'Details'))])
        self.assertEqual(response.status_code, 422)
        response = self.client.post('/api/generate', headers={**headers, 'Content-Type': 'application/json'},
            content=iter([b'x' * (1024 * 1024) for _ in range(7)]))
        self.assertEqual(response.status_code, 413)
        self.ai.assert_not_called()

    def test_five_per_minute_separate_users_and_no_daily_cap(self):
        headers = self.login()
        for _ in range(5):
            self.assertEqual(self.generate(headers).status_code, 200)
        self.assertEqual(self.generate(headers).status_code, 429)
        self.assertEqual(self.ai.await_count, 5)
        other = {'email': f'other-{uuid4().hex}@example.com', 'password': self.credentials['password']}
        verified_registration(self.client, other)
        token = self.client.post('/api/auth/login', json=other).json()['access_token']
        self.assertEqual(self.generate({'Authorization': 'Bearer ' + token}).status_code, 200)
        with SessionLocal() as db:
            for row in db.scalars(select(GenerationAttempt).where(GenerationAttempt.user_id == self.user_id)):
                row.created_at -= timedelta(minutes=2)
            # More than the old daily allowance must not prevent a new minute.
            db.add_all([GenerationAttempt(user_id=self.user_id, created_at=datetime.now(timezone.utc) - timedelta(hours=1)) for _ in range(100)])
            db.commit()
        self.assertEqual(self.generate(headers).status_code, 200)
        self.assertEqual(self.ai.await_count, 7)

    def test_concurrent_limit(self):
        headers = self.login(); barrier = Barrier(6)
        def call(_):
            barrier.wait(timeout=10)
            with TestClient(app) as client: return client.post('/api/generate', json=self.payload, headers=headers).status_code
        with patch.object(settings, 'GENERATION_RATE_LIMIT_PER_MINUTE', 2), ThreadPoolExecutor(max_workers=6) as pool:
            statuses = list(pool.map(call, range(6)))
        self.assertCountEqual(statuses, [200, 200, 429, 429, 429, 429]); self.assertEqual(self.ai.await_count, 2)

    def test_image_field_rejected(self):
        headers = self.login()
        response = self.client.post('/api/generate', json={**self.payload, 'image': 'untrusted'}, headers=headers)
        self.assertEqual(response.status_code, 422)
        self.ai.assert_not_called()

    def test_failure_no_history(self):
        headers = self.login(); self.ai.side_effect = ai_service.AIUnavailable()
        self.assertEqual(self.generate(headers).status_code, 503)
        with SessionLocal() as db:
            self.assertIsNone(db.scalar(select(Generation).where(Generation.user_id == self.user_id)))
            self.assertIsNotNone(db.scalar(select(GenerationAttempt).where(GenerationAttempt.user_id == self.user_id)))

    def test_disabled_payments_preferences(self):
        headers = self.login()
        self.assertEqual(self.client.get('/api/payments', headers=headers).status_code, 404)
        self.assertEqual(self.client.post('/api/payments/payway/callback', json={}).status_code, 404)
        self.assertEqual(self.client.post('/api/auth/preferences', json={'ui_language': 'km'}, headers=headers).json()['ui_language'], 'km')
        self.assertEqual(self.client.post('/api/auth/preferences', json={'ui_language': 'fr'}, headers=headers).status_code, 422)
        self.assertEqual(self.client.patch(f'/api/users/{self.user_id}', json={'email': 'new@example.com'}, headers=headers).status_code, 422)

class TextOnlyTests(unittest.IsolatedAsyncioTestCase):
    async def test_one_text_call(self):
        create = AsyncMock(return_value=SimpleNamespace(output_text='Description', status='completed', usage=None))
        with patch.object(ai_service, 'get_client', return_value=SimpleNamespace(responses=SimpleNamespace(create=create))):
            await ai_service.generate_product_description(GenerationRequest(product_name='Product', features='Details'))
        create.assert_awaited_once()
        args = create.call_args.kwargs
        self.assertIsInstance(args['input'], str)
        self.assertNotIn('input_image', args['input'])
        self.assertFalse(args['store'])
