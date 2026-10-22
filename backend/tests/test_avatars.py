"""Avatar API and migration regression tests; isolated PostgreSQL only."""
from datetime import datetime, timezone
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from uuid import uuid4

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text

from app.core.avatars import ALLOWED_AVATAR_IDS
from app.core.config import settings
from app.core.security import create_access_token
from app.db.database import SessionLocal, engine
from app.main import app
from app.models.user import User


@unittest.skipUnless(os.environ.get('PHASE1_ISOLATED_DATABASE') == '1', 'requires isolated test database')
class AvatarTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        with SessionLocal() as db:
            users = [User(email=f'avatar-{uuid4().hex}@example.com',
                          email_verified_at=datetime.now(timezone.utc)),
                     User(email=f'avatar-{uuid4().hex}@example.com',
                          google_sub=f'avatar-google-{uuid4().hex}',
                          email_verified_at=datetime.now(timezone.utc))]
            db.add_all(users)
            db.commit()
            self.ids = [user.id for user in users]
        self.headers = {'Authorization': 'Bearer ' + create_access_token(self.ids[0])[0]}

    def update(self, body, headers=None):
        return self.client.patch('/api/profile/avatar', json=body,
                                 headers=self.headers if headers is None else headers)

    def test_defaults_allowlist_persistence_safe_response_and_reset(self):
        me = self.client.get('/api/auth/me', headers=self.headers)
        self.assertIsNone(me.json()['avatar_id'])
        files = {p.stem for p in (Path(__file__).resolve().parents[2] / 'frontend/public/avatars').glob('*.jpg')}
        self.assertEqual(ALLOWED_AVATAR_IDS, files)
        for avatar in sorted(ALLOWED_AVATAR_IDS):
            result = self.update({'avatar_id': avatar})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()['avatar_id'], avatar)
            self.assertFalse({'password_hash', 'google_sub', 'access_token'} & result.json().keys())
            with SessionLocal() as db:
                self.assertEqual(db.get(User, self.ids[0]).avatar_id, avatar)
            self.assertEqual(self.client.get('/api/auth/me', headers=self.headers).json()['avatar_id'], avatar)
        self.assertIsNone(self.update({'avatar_id': None}).json()['avatar_id'])
        with SessionLocal() as db:
            self.assertIsNone(db.get(User, self.ids[0]).avatar_id)

    def test_invalid_values_and_missing_field_are_rejected(self):
        for value in ('avatar-99', 'javascript:alert(1)', '../../secret', 'https://example.com/x.jpg', '/avatars/avatar-01.jpg', '', ' avatar-01', 1, [], {}):
            with self.subTest(value=value):
                self.assertEqual(self.update({'avatar_id': value}).status_code, 422)
        self.assertEqual(self.update({}).status_code, 422)
        self.assertIsNone(self.client.get('/api/auth/me', headers=self.headers).json()['avatar_id'])

    def test_authentication_ownership_and_google_account(self):
        self.assertEqual(self.update({'avatar_id': 'avatar-04'}, {}).status_code, 401)
        self.assertEqual(self.update({'avatar_id': 'avatar-04', 'user_id': self.ids[1]}).status_code, 422)
        self.assertEqual(self.update({'avatar_id': 'avatar-04'}).status_code, 200)
        with SessionLocal() as db:
            self.assertIsNone(db.get(User, self.ids[1]).avatar_id)
        google_headers = {'Authorization': 'Bearer ' + create_access_token(self.ids[1])[0]}
        result = self.update({'avatar_id': 'avatar-05'}, google_headers)
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json()['google_linked'])
        self.assertEqual(result.json()['avatar_id'], 'avatar-05')
        with SessionLocal() as db:
            user = db.get(User, self.ids[0]); user.email_verified_at = None; db.commit()
        self.assertEqual(self.update({'avatar_id': 'avatar-04'}).status_code, 403)
        with SessionLocal() as db:
            user = db.get(User, self.ids[0]); user.email_verified_at = datetime.now(timezone.utc); user.is_active = False; db.commit()
        self.assertEqual(self.update({'avatar_id': 'avatar-04'}).status_code, 403)

    def test_migration_preserves_all_existing_rows_and_downgrade_only_removes_avatar(self):
        schema = 'avatar_migration_' + uuid4().hex
        with engine.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA {schema}'))
        scoped = engine.url.update_query_dict({'options': '-csearch_path=' + schema})
        local = create_engine(scoped)
        try:
            with patch.object(settings, 'database_url', scoped.render_as_string(hide_password=False)):
                config = Config('alembic.ini')
                command.upgrade(config, 'f20b2c3d4e50')
                with local.begin() as conn:
                    conn.execute(text("INSERT INTO users(email, password_hash, google_sub, email_verified_at) VALUES ('legacy@example.com', 'preserved', 'linked', now())"))
                    conn.execute(text("INSERT INTO generations(user_id, product_name, generated_text) VALUES (1, 'Product', 'History')"))
                    conn.execute(text("INSERT INTO email_verification_codes(user_id, code_digest, expires_at, attempts, created_at) VALUES (1, 'fixture-digest', now(), 0, now())"))
                    conn.execute(text("INSERT INTO generation_attempts(user_id, created_at) VALUES (1, now())"))
                tables = inspect(local).get_table_names()
                def snapshot():
                    with local.connect() as conn:
                        return {table: [dict(row) for row in conn.execute(text(f'SELECT * FROM {table}')).mappings()]
                                for table in tables if table != 'alembic_version'}
                before = snapshot()
                command.upgrade(config, 'head')
                command.check(config)
                after = snapshot()
                self.assertIsNone(after['users'][0].pop('avatar_id'))
                self.assertEqual(before, after)
                col = next(c for c in inspect(local).get_columns('users') if c['name'] == 'avatar_id')
                self.assertTrue(col['nullable']); self.assertEqual(col['type'].length, 32)
                command.downgrade(config, 'f20b2c3d4e50')
                self.assertEqual(before, snapshot())
                self.assertEqual(set(tables), set(inspect(local).get_table_names()))
                command.upgrade(config, 'head')
                command.check(config)
        finally:
            local.dispose()
            with engine.begin() as conn:
                conn.execute(text(f'DROP SCHEMA {schema} CASCADE'))
