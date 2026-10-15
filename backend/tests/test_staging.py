"""Deployment contracts; no database or provider calls required."""
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import app


def config(**changes):
    return Settings(_env_file=None, database_url='postgresql://user:pass@localhost/db',
                    jwt_secret_key='test-only-secret-with-at-least-32-bytes', **changes)


class StagingTests(unittest.TestCase):
    def test_database_urls_preserve_credentials_and_options(self):
        suffix = 'user:p%40ss%25word@db.example:5432/staging?sslmode=require'
        for scheme in ('postgresql://', 'postgresql+psycopg://'):
            settings = Settings(_env_file=None, database_url=scheme + suffix,
                                jwt_secret_key='test-only-secret-with-at-least-32-bytes')
            self.assertEqual(settings.database_url, 'postgresql+psycopg://' + suffix)

    def test_origins(self):
        for origin in ('http://localhost:3000', 'https://staging.example'):
            self.assertEqual(config(FRONTEND_URL=origin + '/').FRONTEND_URL, origin)
        for origin in ('*', 'https://*.example', 'http://staging.example',
                       'https://example/path', 'https://user:pass@example',
                       'https://example?query=1', 'https://example#fragment',
                       'https://one.example, https://two.example', 'https://example:bad'):
            with self.subTest(origin=origin), self.assertRaises(ValidationError):
                config(FRONTEND_URL=origin)

    def test_cors_uses_exact_configured_origin(self):
        middleware = next(item for item in app.user_middleware if item.cls is CORSMiddleware)
        for origin in ('http://localhost:3000', 'https://staging.example'):
            with self.subTest(origin=origin):
                test_app = FastAPI()
                options = {**middleware.kwargs, 'allow_origins': [config(FRONTEND_URL=origin).FRONTEND_URL]}
                test_app.add_middleware(CORSMiddleware, **options)
                with TestClient(test_app) as client:
                    for candidate, expected in ((origin, 200), ('https://untrusted.example', 400)):
                        response = client.options('/health', headers={
                            'Origin': candidate, 'Access-Control-Request-Method': 'GET',
                            'Access-Control-Request-Headers': 'Authorization'})
                        self.assertEqual(response.status_code, expected)
                        self.assertNotIn('access-control-allow-credentials', response.headers)
                        self.assertEqual(response.headers.get('access-control-allow-origin'),
                                         origin if expected == 200 else None)

    def test_health_has_no_database_or_external_calls(self):
        with patch('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Database call')), \
             patch('httpx.AsyncClient.send', side_effect=AssertionError('External call')), \
             TestClient(app) as client:
            response = client.get('/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})
