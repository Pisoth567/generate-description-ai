"""Transaction failure tests preserve safe database errors.

Run: .venv/bin/python -m unittest discover -s tests -v
Only records created by these tests are changed; cleanup soft-deletes them.
"""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.api.deps import user_database
from app.db.database import SessionLocal
from app.models.user import User
from app.schemas.auth import RegisterRequest
from app.schemas.user import UserCreate, UserUpdate
from app.services import auth_service, user_service


class TransactionFailureTests(unittest.TestCase):
    def setUp(self):
        boundary = patch('app.services.verification_service.issue')
        boundary.start()
        self.addCleanup(boundary.stop)

    def test_writes_rollback_and_hide_database_errors(self):
        actions = (
            lambda db: user_service.create_user(db, UserCreate(email='failure@example.com')),
            lambda db: user_service.update_user(db, 1, UserUpdate(ui_language='km')),
            lambda db: user_service.deactivate_user(db, 1),
            lambda db: auth_service.register_user(db, RegisterRequest(
                email='failure@example.com', password='test-only-password')),
        )
        for index, action in enumerate(actions):
            with self.subTest(operation=index):
                db = MagicMock()
                db.scalar.return_value = User(id=1)
                db.commit.side_effect = SQLAlchemyError('private database details')
                with patch.object(user_service, 'get_user_by_email', return_value=None), \
                     patch.object(auth_service, 'hash_password', return_value='test-hash'):
                    with self.assertRaisesRegex(user_service.DatabaseFailure, '^Database operation failed$'):
                        action(db)
                db.rollback.assert_called_once()

    def test_duplicate_registration_race_rolls_back(self):
        db = MagicMock()
        db.scalar.return_value = None
        original = MagicMock()
        original.sqlstate = '23505'
        original.diag.constraint_name = 'ix_users_email'
        db.commit.side_effect = IntegrityError('private SQL', {}, original)
        with patch.object(auth_service, 'hash_password', return_value='test-hash'):
            with self.assertRaises(user_service.DuplicateEmail):
                auth_service.register_user(db, RegisterRequest(
                    email='race@example.com', password='test-only-password'))
        db.rollback.assert_called_once()

    def test_database_failure_maps_to_safe_http_500(self):
        dependency = user_database(MagicMock())
        next(dependency)
        with self.assertRaises(HTTPException) as caught:
            dependency.throw(user_service.DatabaseFailure())
        self.assertEqual(caught.exception.status_code, 500)
        self.assertEqual(caught.exception.detail, 'Database operation failed')


if __name__ == '__main__':
    unittest.main()


def tearDownModule():
    from app.db.database import engine
    engine.dispose()
