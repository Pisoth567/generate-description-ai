"""Exercise upgrade/backfill/downgrade in a disposable schema, never deployment data."""
import os
from uuid import uuid4
import unittest
from unittest.mock import patch
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from app.core.config import settings
from app.db.database import engine

@unittest.skipUnless(os.environ.get('PHASE1_ISOLATED_DATABASE') == '1', 'requires isolated test database')
class MigrationTests(unittest.TestCase):
    def test_legacy_backfill_and_nondestructive_downgrade(self):
        schema = 'phase1_migration_' + uuid4().hex
        with engine.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA {schema}'))
        scoped = engine.url.update_query_dict({'options': '-csearch_path=' + schema})
        local = create_engine(scoped)
        try:
            with patch.object(settings, 'database_url', scoped.render_as_string(hide_password=False)):
                config = Config('alembic.ini')
                command.upgrade(config, '7b81e2ac940d')
                with local.begin() as conn:
                    conn.execute(text("INSERT INTO users(email, credits, password_hash) VALUES ('legacy@example.com', 0, 'preserved-password-hash')"))
                    conn.execute(text("INSERT INTO generations(user_id, product_name, generated_text) VALUES (1, 'Legacy product', 'Preserved history')"))
                    conn.execute(text("INSERT INTO users(email, google_sub) VALUES ('google@example.com', 'preserved-google-sub')"))
                command.upgrade(config, 'head')
                with local.begin() as conn:
                    user = conn.execute(text('SELECT email_verified_at, ui_language, credits FROM users WHERE id=1')).one()
                    self.assertIsNone(user[0]); self.assertEqual(user[1:], ('en', 0))
                    self.assertIsNotNone(conn.execute(text("SELECT email_verified_at FROM users WHERE google_sub='preserved-google-sub'")).scalar())
                    self.assertEqual(conn.execute(text('SELECT password_hash FROM users WHERE id=1')).scalar(), 'preserved-password-hash')
                    conn.execute(text("INSERT INTO users(email) VALUES ('new@example.com')"))
                    self.assertIsNone(conn.execute(text("SELECT email_verified_at FROM users WHERE email='new@example.com'")).scalar())
                command.check(config)
                command.downgrade(config, '7b81e2ac940d')
                with local.connect() as conn:
                    self.assertEqual(conn.execute(text('SELECT count(*) FROM users')).scalar(), 3)
                    self.assertEqual(conn.execute(text('SELECT generated_text FROM generations')).scalar(), 'Preserved history')
                    self.assertEqual(conn.execute(text('SELECT credits FROM users WHERE id=1')).scalar(), 0)
        finally:
            local.dispose()
            with engine.begin() as conn:
                conn.execute(text(f'DROP SCHEMA {schema} CASCADE'))
