"""HTTP integration tests against local uvicorn and migrated PostgreSQL.

Start: .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8765
Run:   .venv/bin/python -m unittest discover -s tests -v
Override the server with TEST_API_URL. Only new test accounts are modified.
Tokens, passwords and hashes are never printed by these tests.
"""
from datetime import datetime, timedelta, timezone
import json
import os
import secrets
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

import jwt

from app.core.config import settings
from app.core.security import verify_password
from app.db.database import SessionLocal
from app.models.user import User
from app.schemas.user import UserCreate
from app.services import user_service

BASE_URL = os.environ.get('TEST_API_URL', 'http://127.0.0.1:8765')


def request(method, path, data=None, token=None, headers=None):
    request_headers = {'Content-Type': 'application/json', **(headers or {})}
    if token is not None:
        request_headers['Authorization'] = 'Bearer ' + token
    body = None if data is None else json.dumps(data).encode()
    req = Request(BASE_URL + path, data=body, method=method, headers=request_headers)
    try:
        response = urlopen(req, timeout=15)
    except HTTPError as exc:
        response = exc
    with response:
        raw = response.read().decode()
        result = json.loads(raw) if 'application/json' in response.headers.get('Content-Type', '') else raw
        return response.status, result, response.headers


class AuthAPITests(unittest.TestCase):
    def setUp(self):
        self.created = []
        self.addCleanup(self.deactivate_test_users)
        self.password = secrets.token_urlsafe(24)
        self.email = f'auth-{uuid4().hex}@example.com'
        self.user = self.register(self.email, self.password)
        self.token = self.login(self.email, self.password)

    def deactivate_test_users(self):
        with SessionLocal() as db:
            for user_id in self.created:
                user_service.deactivate_user(db, user_id)

    def register(self, email, password):
        code, body, _ = request('POST', '/api/auth/register', {'email': email, 'password': password})
        self.assertEqual(code, 201)
        self.created.append(body['id'])
        self.assertNotIn('password_hash', body)
        self.assertNotIn('password', body)
        self.assertEqual((body['plan'], body['credits'], body['is_active']), ('free', 10, True))
        return body

    def login(self, email, password):
        code, body, _ = request('POST', '/api/auth/login', {'email': email, 'password': password})
        self.assertEqual(code, 200)
        self.assertEqual(body['token_type'], 'bearer')
        self.assertEqual(body['expires_in'], settings.access_token_expire_minutes * 60)
        self.assertTrue(bool(body['access_token']))
        return body['access_token']

    def assert_unauthorized(self, response, detail=None):
        code, body, headers = response
        self.assertEqual(code, 401)
        self.assertEqual(headers.get('WWW-Authenticate'), 'Bearer')
        if detail:
            self.assertEqual(body, {'detail': detail})

    def test_registration_storage_duplicate_login_and_me(self):
        with SessionLocal() as db:
            user = user_service.get_user(db, self.user['id'])
            self.assertTrue(bool(user.password_hash))
            self.assertTrue(user.password_hash.startswith('$argon2id$'))
            self.assertTrue(user.password_hash != self.password)
            self.assertTrue(verify_password(self.password, user.password_hash))
        code, body, _ = request('POST', '/api/auth/register', {
            'email': self.email.upper(), 'password': self.password})
        self.assertEqual((code, body), (409, {'detail': 'Email already exists'}))
        normalized_token = self.login(self.email.upper(), self.password)
        code, body, _ = request('GET', '/api/auth/me', token=normalized_token)
        self.assertEqual(code, 200)
        self.assertEqual(body, self.user)
        claims = jwt.decode(self.token, settings.jwt_secret_key.get_secret_value(),
                            algorithms=[settings.jwt_algorithm])
        self.assertEqual(set(claims), {'sub', 'iat', 'exp', 'type'})
        self.assertEqual(claims['sub'], str(self.user['id']))
        self.assertEqual(claims['type'], 'access')
        self.assertGreater(claims['exp'], claims['iat'])

    def test_wrong_unknown_legacy_and_malformed_hash_credentials(self):
        for email, password in ((self.email, 'incorrect-password'),
                                (f'unknown-{uuid4().hex}@example.com', self.password)):
            self.assert_unauthorized(request('POST', '/api/auth/login', {
                'email': email, 'password': password}), 'Invalid email or password')
        with SessionLocal() as db:
            legacy = user_service.create_user(db, UserCreate(email=f'legacy-{uuid4().hex}@example.com'))
            self.created.append(legacy.id)
            legacy_email = legacy.email
            self.assertIsNone(legacy.password_hash)
        self.assert_unauthorized(request('POST', '/api/auth/login', {
            'email': legacy_email, 'password': self.password}), 'Invalid email or password')
        with SessionLocal() as db:
            user = user_service.get_user(db, self.user['id'])
            user.password_hash = 'invalid-stored-hash'
            db.commit()
        self.assert_unauthorized(request('POST', '/api/auth/login', {
            'email': self.email, 'password': self.password}), 'Invalid email or password')

    def test_missing_invalid_expired_and_invalid_claims(self):
        self.assert_unauthorized(request('GET', '/api/auth/me'))
        self.assert_unauthorized(request('GET', '/api/auth/me', token='malformed'))
        self.assert_unauthorized(request('GET', '/api/auth/me', headers={'Authorization': 'Basic invalid'}))
        now = datetime.now(timezone.utc)
        base = {'sub': str(self.user['id']), 'iat': now, 'exp': now + timedelta(minutes=5), 'type': 'access'}
        variants = [
            {**base, 'iat': now - timedelta(hours=1), 'exp': now - timedelta(seconds=1)},
            {**base, 'type': 'refresh'}, {**base, 'sub': 'invalid'},
            {**base, 'sub': '-1'}, {**base, 'sub': '0'}, {**base, 'sub': '9' * 100},
            {**base, 'sub': self.user['id']}, {**base, 'iat': now + timedelta(hours=1)},
        ]
        for key in ('sub', 'iat', 'exp', 'type'):
            variants.append({k: v for k, v in base.items() if k != key})
        for claims in variants:
            token = jwt.encode(claims, settings.jwt_secret_key.get_secret_value(), algorithm=settings.jwt_algorithm)
            self.assert_unauthorized(request('GET', '/api/auth/me', token=token))
        forged = jwt.encode(base, secrets.token_urlsafe(48), algorithm=settings.jwt_algorithm)
        self.assert_unauthorized(request('GET', '/api/auth/me', token=forged))
        unsigned = jwt.encode(base, '', algorithm='none')
        self.assert_unauthorized(request('GET', '/api/auth/me', token=unsigned))
        with SessionLocal() as db:
            # Find an absent ID without deleting an account.
            absent = 2_147_483_647
            while db.get(User, absent) is not None:
                absent -= 1
        missing = jwt.encode({**base, 'sub': str(absent)}, settings.jwt_secret_key.get_secret_value(),
                             algorithm=settings.jwt_algorithm)
        self.assert_unauthorized(request('GET', '/api/auth/me', token=missing))

    def test_ownership_email_update_deactivation_and_inactive_login(self):
        other = self.register(f'other-{uuid4().hex}@example.com', self.password)
        own_path = f'/api/users/{self.user["id"]}'
        other_path = f'/api/users/{other["id"]}'
        self.assertEqual(request('GET', own_path, token=self.token)[0], 200)
        for method, data in (('GET', None), ('PATCH', {'email': self.email}), ('DELETE', None)):
            self.assert_unauthorized(request(method, own_path, data))
            self.assertEqual(request(method, other_path, data, token=self.token)[0], 403)
        self.assertEqual(request('PATCH', own_path, {'email': other['email']}, token=self.token)[0], 409)
        new_email = f'updated-{uuid4().hex}@example.com'
        code, body, _ = request('PATCH', own_path, {'email': new_email}, token=self.token)
        self.assertEqual(code, 200)
        self.assertEqual(body['email'], new_email)
        self.assertNotIn('password_hash', body)
        self.login(new_email, self.password)
        code, body, _ = request('DELETE', own_path, token=self.token)
        self.assertEqual(code, 200)
        self.assertFalse(body['is_active'])
        with SessionLocal() as db:
            self.assertFalse(user_service.get_user(db, self.user['id']).is_active)
        for path in ('/api/auth/me', own_path):
            self.assertEqual(request('GET', path, token=self.token)[0], 403)
        code, body, _ = request('POST', '/api/auth/login', {'email': new_email, 'password': self.password})
        self.assertEqual((code, body), (403, {'detail': 'Account is inactive'}))
        self.assert_unauthorized(request('POST', '/api/auth/login', {
            'email': new_email, 'password': 'incorrect-password'}), 'Invalid email or password')

    def test_removed_routes_protected_fields_and_password_validation(self):
        own_path = f'/api/users/{self.user["id"]}'
        for token in (None, self.token):
            for method, path, data in (('GET', '/api/users', None),
                                       ('POST', '/api/users', {'email': self.email}),
                                       ('POST', own_path + '/credits', {'amount': 100})):
                self.assertIn(request(method, path, data, token=token)[0], (404, 405))
        for field, value in (('plan', 'pro'), ('credits', 100), ('is_active', False),
                             ('password_hash', 'forbidden'), ('password', self.password)):
            code, body, _ = request('PATCH', own_path, {field: value}, token=self.token)
            self.assertEqual(code, 422)
            self.assertFalse(self.password in json.dumps(body))
            code, body, _ = request('POST', '/api/auth/register', {
                'email': self.email, 'password': self.password, **{field: value}})
            if field != 'password':
                self.assertEqual(code, 422)
        for password in ('x' * 7, 'x' * 129):
            code, body, _ = request('POST', '/api/auth/register', {
                'email': self.email, 'password': password})
            self.assertEqual(code, 422)
            self.assertFalse(password in json.dumps(body))
        padded_password = '  ' + secrets.token_urlsafe(10) + '  '
        email = f'whitespace-{uuid4().hex}@example.com'
        self.register(email, padded_password)
        self.login(email, padded_password)
        self.assert_unauthorized(request('POST', '/api/auth/login', {
            'email': email, 'password': padded_password.strip()}), 'Invalid email or password')
        self.assertEqual(request('GET', own_path, token=self.token)[1]['credits'], 10)

    def test_existing_endpoints_openapi_and_cors(self):
        for path in ('/', '/health', '/health/database', '/docs'):
            self.assertEqual(request('GET', path)[0], 200)
        code, body, _ = request('POST', '/api/generate', {
            'product_name': 'Test', 'category': 'demo', 'features': ['speed', 'quality']})
        self.assertEqual(code, 401)
        code, schema, _ = request('GET', '/openapi.json')
        self.assertEqual(code, 200)
        self.assertNotIn('/api/users', schema['paths'])
        self.assertNotIn('/api/users/{user_id}/credits', schema['paths'])
        self.assertNotIn('password_hash', schema['components']['schemas']['UserResponse']['properties'])
        self.assertIn('security', schema['paths']['/api/auth/me']['get'])
        headers = {'Origin': settings.FRONTEND_URL, 'Access-Control-Request-Method': 'PATCH',
                   'Access-Control-Request-Headers': 'authorization,content-type'}
        code, _, response_headers = request('OPTIONS', f'/api/users/{self.user["id"]}', headers=headers)
        self.assertEqual(code, 200)
        self.assertEqual(response_headers.get('Access-Control-Allow-Origin'), settings.FRONTEND_URL)
        self.assertIn('authorization', response_headers.get('Access-Control-Allow-Headers').lower())
        headers['Origin'] = 'https://untrusted.example'
        self.assertEqual(request('OPTIONS', '/api/auth/me', headers=headers)[0], 400)


if __name__ == '__main__':
    unittest.main()
