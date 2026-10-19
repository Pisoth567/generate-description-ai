"""Real PostgreSQL; Google's cryptographic verification boundary is always mocked."""
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import time
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import event, inspect, select

from app.core.config import settings
from app.core.security import create_access_token, decode_access_token
from app.db.database import SessionLocal, engine
from app.main import app
from app.models.user import User
from app.services import google_auth_service as google, user_service


class GoogleAuthTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.email = f'google-{uuid4().hex}@example.com'
        self.sub = uuid4().hex
        self.created = set()
        self.addCleanup(self.cleanup)
        config = patch.object(settings, 'GOOGLE_CLIENT_ID', 'test-client')
        config.start()
        self.addCleanup(config.stop)
        verifier = patch.object(google.id_token, 'verify_oauth2_token')
        self.verify = verifier.start()
        self.addCleanup(verifier.stop)
        self.claims = dict(sub=self.sub, email=self.email, email_verified=True,
                           nonce='test-nonce', aud='test-client',
                           iss='https://accounts.google.com', exp=time.time() + 600)
        self.verify.return_value = self.claims
        self.payload = dict(id_token='test-only-id-token', nonce='test-nonce')

    def cleanup(self):
        with SessionLocal() as db:
            ids = set(db.scalars(select(User.id).where(User.google_sub == self.sub))) | self.created
            for user_id in ids:
                user_service.deactivate_user(db, user_id)

    def local(self, email=None, **values):
        with SessionLocal() as db:
            user = User(email=email or self.email, email_verified_at=datetime.now(timezone.utc), **values)
            db.add(user)
            db.commit()
            db.refresh(user)
            self.created.add(user.id)
            return user.id

    def login(self):
        return self.client.post('/api/auth/google', json=self.payload)

    def link(self, user_id):
        token, _ = create_access_token(user_id)
        return self.client.post('/api/auth/google/link', json=self.payload,
                                headers={'Authorization': 'Bearer ' + token})

    def test_new_and_repeat_login_response_privacy(self):
        response = self.login()
        self.assertEqual(response.status_code, 200)
        token = response.json()['access_token']
        user_id = decode_access_token(token)
        with SessionLocal() as db:
            user = db.get(User, user_id)
            self.assertEqual((user.email, user.google_sub, user.password_hash, user.is_active), (self.email, self.sub, None, True))
            self.assertIsNotNone(user.email_verified_at)
            db.commit()
        second = self.login()
        self.assertEqual(second.status_code, 200)
        self.assertEqual(decode_access_token(second.json()['access_token']), user_id)
        me = self.client.get('/api/auth/me', headers={'Authorization': 'Bearer ' + token}).json()
        self.assertNotIn('credits', me)
        self.assertNotIn('plan', me)
        self.assertTrue(me['google_linked'])
        self.assertNotIn('google_sub', me)
        self.assertNotIn('password_hash', me)
        with SessionLocal() as db:
            self.assertEqual(len(list(db.scalars(select(User).where(User.google_sub == self.sub)))), 1)
        self.assertEqual(self.client.post('/api/auth/login', json={
            'email': self.email, 'password': 'wrong-password'}).json()['detail'], 'Invalid email or password')
        self.assertEqual(self.client.post('/api/auth/register', json={
            'email': self.email, 'password': 'test-password-123'}).status_code, 409)
        self.verify.assert_called_with(self.payload['id_token'], unittest.mock.ANY, audience='test-client')

    def test_invalid_signature(self):
        self.verify.side_effect = ValueError('sensitive provider detail')
        response = self.login()
        self.assertEqual(response.status_code, 401)
        self.assertNotIn('sensitive', response.text)

    def test_database_google_subject_column_and_unique_index(self):
        inspector = inspect(engine)
        column = next(c for c in inspector.get_columns('users') if c['name'] == 'google_sub')
        self.assertTrue(column['nullable'])
        self.assertEqual(column['type'].length, 255)
        index = next(i for i in inspector.get_indexes('users') if i['name'] == 'ix_users_google_sub')
        self.assertTrue(index['unique'])
        self.assertEqual(index['column_names'], ['google_sub'])

    def test_invalid_claims_and_nonce(self):
        for key, value in [('email_verified', False), ('email_verified', 'true'),
                           ('sub', None), ('sub', ''), ('sub', ' '), ('sub', 12), ('sub', 'x' * 256),
                           ('email', None), ('email', 'invalid'), ('aud', 'other-client'),
                           ('iss', 'https://untrusted.example'), ('exp', 0), ('exp', None),
                           ('nonce', None), ('nonce', 'wrong')]:
            with self.subTest(claim=key, value=value):
                self.verify.return_value = {**self.claims, key: value}
                self.assertEqual(self.login().status_code, 401)
        self.verify.return_value = {k: v for k, v in self.claims.items() if k != 'sub'}
        self.assertEqual(self.login().status_code, 401)

    def test_password_and_legacy_email_conflicts_never_link(self):
        user_id = self.local(password_hash='existing-hash')
        for password_hash in ('existing-hash', None):
            with SessionLocal() as db:
                db.get(User, user_id).password_hash = password_hash
                db.commit()
            self.verify.return_value = {**self.claims, 'email': self.email.upper()}
            response = self.login()
            self.assertEqual(response.status_code, 409)
            self.assertIn('Sign in with your password first', response.json()['detail'])
            with SessionLocal() as db:
                users = list(db.scalars(select(User).where(User.email == self.email)))
                self.assertEqual(len(users), 1)
                self.assertIsNone(users[0].google_sub)

    def test_inactive_google_account_and_link_rejected(self):
        user_id = self.local(google_sub=self.sub, is_active=False)
        self.assertEqual(self.login().status_code, 403)
        self.assertEqual(self.link(user_id).status_code, 403)

    def test_explicit_link_and_idempotency_preserves_password(self):
        user_id = self.local(password_hash='existing-hash')
        self.verify.return_value = {**self.claims, 'email': self.email.upper()}
        for _ in range(2):
            response = self.link(user_id)
            self.assertEqual((response.status_code, response.json()), (200, {'linked': True}))
        with SessionLocal() as db:
            user = db.get(User, user_id)
            self.assertEqual((user.google_sub, user.password_hash), (self.sub, 'existing-hash'))
        self.assertEqual(decode_access_token(self.login().json()['access_token']), user_id)

    def test_link_requires_auth_and_matching_email(self):
        self.assertEqual(self.client.post('/api/auth/google/link', json=self.payload).status_code, 401)
        self.verify.assert_not_called()
        user_id = self.local(email=f'other-{uuid4().hex}@example.com')
        self.assertEqual(self.link(user_id).status_code, 409)
        with SessionLocal() as db:
            self.assertIsNone(db.get(User, user_id).google_sub)

    def test_subject_owned_by_other_account_and_different_link(self):
        user_id = self.local()
        owner_id = self.local(email=f'owner-{uuid4().hex}@example.com', google_sub=self.sub)
        self.assertEqual(self.link(user_id).status_code, 409)
        with SessionLocal() as db:
            self.assertIsNone(db.get(User, user_id).google_sub)
            self.assertEqual(db.get(User, owner_id).google_sub, self.sub)
        # Sub lookup, not changed provider email, identifies the existing owner.
        self.assertEqual(decode_access_token(self.login().json()['access_token']), owner_id)
        with SessionLocal() as db:
            db.get(User, user_id).google_sub = uuid4().hex
            db.commit()
        self.verify.return_value = {**self.claims, 'sub': uuid4().hex}
        self.assertEqual(self.link(user_id).status_code, 409)
        self.assertEqual(self.login().status_code, 409)

    def test_configuration_and_validation_safe_errors(self):
        with patch.object(settings, 'GOOGLE_CLIENT_ID', ''):
            self.assertEqual(self.login().status_code, 503)
        for payload in ({'id_token': 'private-' * 3000, 'nonce': 'test'},
                        {'id_token': 'private-token', 'nonce': ''},
                        {**self.payload, 'unexpected': 'private-value'}):
            response = self.client.post('/api/auth/google', json=payload)
            self.assertEqual(response.status_code, 422)
            self.assertNotIn('private-', response.text)
            self.assertNotIn('test-only-id-token', response.text)

    def test_concurrent_creation_one_user(self):
        barrier = Barrier(2)
        def synchronize(conn, cursor, statement, parameters, context, executemany):
            if statement.startswith('INSERT INTO users'):
                barrier.wait(timeout=10)
        event.listen(engine, 'before_cursor_execute', synchronize)
        try:
            def attempt(_):
                with TestClient(app) as client:
                    response = client.post('/api/auth/google', json=self.payload)
                    self.assertEqual(response.status_code, 200)
                    return decode_access_token(response.json()['access_token'])
            with ThreadPoolExecutor(max_workers=2) as pool:
                ids = list(pool.map(attempt, range(2)))
        finally:
            event.remove(engine, 'before_cursor_execute', synchronize)
        self.assertEqual(ids[0], ids[1])
        with SessionLocal() as db:
            users = list(db.scalars(select(User).where(User.google_sub == self.sub)))
            self.assertEqual(len(users), 1)

    def test_concurrent_different_subject_same_email_conflicts(self):
        barrier = Barrier(2)
        identities = [google.GoogleIdentity(self.sub, self.email, True),
                      google.GoogleIdentity(uuid4().hex, self.email, True)]
        def synchronize(conn, cursor, statement, parameters, context, executemany):
            if statement.startswith('INSERT INTO users'):
                barrier.wait(timeout=10)
        event.listen(engine, 'before_cursor_execute', synchronize)
        try:
            def attempt(identity):
                from fastapi import HTTPException
                with SessionLocal() as db:
                    try:
                        user = google.authenticate_google_user(db, identity)
                        self.created.add(user.id)
                        return 200
                    except HTTPException as exc:
                        return exc.status_code
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(attempt, identities))
        finally:
            event.remove(engine, 'before_cursor_execute', synchronize)
        self.assertEqual(sorted(results), [200, 409])
