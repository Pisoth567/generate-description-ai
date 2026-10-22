"""SMTP and migration regressions. No external provider connections."""
import os
import smtplib
import ssl
import unittest
from unittest.mock import patch
from uuid import uuid4

from alembic import command
from alembic.config import Config
from fastapi import HTTPException
from pydantic import SecretStr
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import engine
from app.models.user import User
from app.schemas.generation import GenerationRequest
from app.services import email_service, generation_service, ai_service


class SMTPTests(unittest.TestCase):
    def setUp(self):
        values = dict(EMAIL_PROVIDER='smtp', EMAIL_FROM='App <sender@example.test>',
                      SMTP_HOST='smtp.example.test', SMTP_PORT=587,
                      SMTP_USERNAME='fixture-user', SMTP_PASSWORD=SecretStr('fixture-only'),
                      SMTP_USE_TLS=True,
                      EMAIL_VERIFICATION_SECRET=SecretStr('test-only-verification-secret-at-least-32-bytes'))
        for key, value in values.items():
            p = patch.object(settings, key, value)
            p.start()
            self.addCleanup(p.stop)
        self.smtp = patch.object(email_service.smtplib, 'SMTP').start()
        self.addCleanup(patch.stopall)
        self.client = self.smtp.return_value.__enter__.return_value
        self.client.send_message.return_value = {}

    def test_starttls_before_auth_and_multipart_content(self):
        email_service.send_verification('recipient@example.test', '123456')
        self.assertEqual([c[0] for c in self.client.method_calls],
                         ['ehlo', 'starttls', 'ehlo', 'login', 'send_message'])
        context = self.client.starttls.call_args.kwargs['context']
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)
        message = self.client.send_message.call_args.args[0]
        self.assertEqual(message['Subject'], 'Verify your email')
        for subtype in ('plain', 'html'):
            body = message.get_body(preferencelist=(subtype,)).get_content()
            for phrase in ('Generate Description AI', '123456', '10 minutes', 'did not register'):
                self.assertIn(phrase, body)
        self.assertNotIn('fixture-only', message.as_string())

    @unittest.skipUnless(os.environ.get('PHASE1_ISOLATED_DATABASE') == '1', 'requires isolated test database')
    def test_disabled_provider_registration_and_resend_return_503_without_session(self):
        from datetime import timedelta
        from fastapi.testclient import TestClient
        from sqlalchemy import select
        from app.main import app
        from app.db.database import SessionLocal
        from app.models.verification import EmailVerificationCode
        credentials = {'email': f'smtp-{uuid4().hex}@example.com', 'password': 'fixture-password-only'}
        with patch.object(settings, 'EMAIL_PROVIDER', ''), TestClient(app) as client:
            result = client.post('/api/auth/register', json=credentials)
            self.assertEqual(result.status_code, 503)
            self.assertNotIn('access_token', result.text)
            self.assertNotIn('set-cookie', result.headers)
            with SessionLocal() as db:
                self.assertIsNone(db.scalar(select(User).where(User.email == credentials['email'])))
            with patch.object(email_service, 'send_verification'):
                registered = client.post('/api/auth/register', json=credentials)
            self.assertEqual(registered.status_code, 201)
            with SessionLocal() as db:
                challenge = db.scalar(select(EmailVerificationCode).where(
                    EmailVerificationCode.user_id == registered.json()['id']))
                challenge.created_at -= timedelta(seconds=61)
                db.commit()
            result = client.post('/api/auth/resend-verification', json={'email': credentials['email']})
            self.assertEqual(result.status_code, 503)
            self.assertEqual(result.json()['detail']['code'], 'email_configuration_required')
            self.assertEqual(client.post('/api/auth/login', json=credentials).status_code, 403)
        self.smtp.assert_not_called()

    def test_implicit_tls_has_no_cleartext_fallback(self):
        with patch.object(settings, 'SMTP_USE_TLS', False), patch.object(settings, 'SMTP_PORT', 465), \
             patch.object(email_service.smtplib, 'SMTP_SSL') as transport:
            client = transport.return_value.__enter__.return_value
            client.send_message.return_value = {}
            email_service.send_verification('recipient@example.test', '123456')
            self.assertEqual(transport.call_args.kwargs['context'].verify_mode, ssl.CERT_REQUIRED)
            client.starttls.assert_not_called()
            client.login.assert_called_once()
        self.smtp.assert_not_called()

    def test_missing_config_never_connects(self):
        for name, value in [('EMAIL_PROVIDER', ''), ('SMTP_HOST', ''), ('SMTP_USERNAME', ''),
                            ('SMTP_PASSWORD', None), ('EMAIL_FROM', ''),
                            ('EMAIL_VERIFICATION_SECRET', SecretStr('short'))]:
            with self.subTest(field=name), patch.object(settings, name, value):
                with self.assertRaises(HTTPException) as caught:
                    email_service.send_verification('recipient@example.test', '123456')
                self.assertEqual(caught.exception.status_code, 503)
                self.assertEqual(caught.exception.detail, {'code': 'email_configuration_required'})
        self.smtp.assert_not_called()

    def test_tls_auth_recipient_and_network_failures_sanitized(self):
        for method in ('starttls', 'login', 'send_message'):
            with self.subTest(stage=method):
                target = getattr(self.client, method)
                target.side_effect = smtplib.SMTPException('private provider detail')
                with self.assertRaises(HTTPException) as caught:
                    email_service.send_verification('recipient@example.test', '123456')
                self.assertEqual(caught.exception.detail, {'code': 'email_delivery_unavailable'})
                target.side_effect = None
        self.client.send_message.return_value = {'recipient@example.test': (550, b'rejected')}
        with self.assertRaises(HTTPException):
            email_service.send_verification('recipient@example.test', '123456')
        self.smtp.side_effect = OSError('private network detail')
        with self.assertRaises(HTTPException) as caught:
            email_service.send_verification('recipient@example.test', '123456')
        self.assertEqual(caught.exception.status_code, 503)


@unittest.skipUnless(os.environ.get('PHASE1_ISOLATED_DATABASE') == '1', 'requires isolated test database')
class CleanupMigrationTests(unittest.TestCase):
    def test_upgrade_preserves_accounts_history_and_downgrade_restores_schema(self):
        schema = 'phase2_migration_' + uuid4().hex
        with engine.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA {schema}'))
        scoped = engine.url.update_query_dict({'options': '-csearch_path=' + schema})
        local = create_engine(scoped)
        try:
            with patch.object(settings, 'database_url', scoped.render_as_string(hide_password=False)):
                config = Config('alembic.ini')
                command.upgrade(config, 'e10a1b2c3d40')
                legacy = inspect(local)
                original_indexes = {i['name'] for i in legacy.get_indexes('payments')}
                original_constraints = {c['name'] for c in legacy.get_check_constraints('payments')}
                with local.begin() as conn:
                    conn.execute(text("INSERT INTO users(email, credits, password_hash, email_verified_at) VALUES ('legacy@example.test', 0, 'preserved-hash', now())"))
                    conn.execute(text("INSERT INTO generations(user_id, product_name, generated_text) VALUES (1, 'Legacy product', 'Preserved history')"))
                    conn.execute(text("INSERT INTO payments(user_id, tran_id, package_code, amount, credits) VALUES (1, 'legacy', 'legacy', 1, 10)"))
                # Supply the newer avatar column for the current ORM while testing
                # legacy zero-balance generation; remove it before migration replay.
                with local.begin() as conn:
                    conn.execute(text('ALTER TABLE users ADD COLUMN avatar_id VARCHAR(32)'))
                # The current code also works before cleanup, with a zero legacy balance.
                with Session(local) as db:
                    result = generation_service.finalize_generation(db, 1,
                        GenerationRequest(product_name='Free text', features='Known details'),
                        ai_service.AIResult('New history', 1))
                    self.assertTrue(result.generation_id)
                with local.connect() as conn:
                    self.assertEqual(conn.scalar(text('SELECT credits FROM users WHERE id=1')), 0)
                with local.begin() as conn:
                    conn.execute(text('ALTER TABLE users DROP COLUMN avatar_id'))
                command.upgrade(config, 'head')
                command.check(config)
                inspector = inspect(local)
                self.assertNotIn('payments', inspector.get_table_names())
                self.assertFalse({'credits', 'plan'} & {c['name'] for c in inspector.get_columns('users')})
                with local.connect() as conn:
                    self.assertEqual(conn.scalar(text('SELECT count(*) FROM users')), 1)
                    self.assertEqual(conn.scalar(text('SELECT password_hash FROM users WHERE id=1')), 'preserved-hash')
                    self.assertEqual(conn.scalar(text('SELECT count(*) FROM generations')), 2)
                command.downgrade(config, 'e10a1b2c3d40')
                inspector = inspect(local)
                self.assertEqual({i['name'] for i in inspector.get_indexes('payments')}, original_indexes)
                self.assertEqual({c['name'] for c in inspector.get_check_constraints('payments')}, original_constraints)
                self.assertEqual(inspector.get_foreign_keys('payments')[0]['referred_table'], 'users')
                with local.connect() as conn:
                    self.assertEqual(conn.scalar(text('SELECT count(*) FROM payments')), 0)
                    self.assertEqual(conn.scalar(text('SELECT count(*) FROM users')), 1)
                    self.assertEqual(conn.scalar(text('SELECT count(*) FROM generations')), 2)
                command.upgrade(config, 'head')
                command.check(config)
        finally:
            local.dispose()
            with engine.begin() as conn:
                conn.execute(text(f'DROP SCHEMA {schema} CASCADE'))
