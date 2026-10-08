"""Internal credit tests use migrated PostgreSQL and isolated test users.

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


class CreditServiceTests(unittest.TestCase):
    def setUp(self):
        with SessionLocal() as db:
            self.user_id = user_service.create_user(
                db, UserCreate(email=f'credits-{uuid4().hex}@example.com')
            ).id

    def tearDown(self):
        with SessionLocal() as db:
            user_service.deactivate_user(db, self.user_id)

    def test_positive_negative_insufficient_and_limits(self):
        with SessionLocal() as db:
            result = user_service.adjust_user_credits(db, self.user_id, 100)
            self.assertEqual((result.previous_credits, result.current_credits), (10, 110))
            result = user_service.adjust_user_credits(db, self.user_id, -1)
            self.assertEqual((result.previous_credits, result.current_credits), (110, 109))
            with self.assertRaisesRegex(user_service.InvalidCreditAdjustment, 'Insufficient credits'):
                user_service.adjust_user_credits(db, self.user_id, -110)
            self.assertEqual(user_service.get_user(db, self.user_id).credits, 109)
            for amount in (0, True, 1.5, '1', 2**31):
                with self.subTest(amount=amount):
                    with self.assertRaises(user_service.InvalidCreditAdjustment):
                        user_service.adjust_user_credits(db, self.user_id, amount)
            self.assertEqual(user_service.get_user(db, self.user_id).credits, 109)

    def test_concurrent_deductions_with_cached_balances(self):
        with SessionLocal() as db:
            user_service.adjust_user_credits(db, self.user_id, -9)
        barrier = Barrier(2)

        def deduct():
            with SessionLocal() as db:
                # Both sessions retain an ORM object with the initial balance.
                cached_user = user_service.get_user(db, self.user_id)
                self.assertEqual(cached_user.credits, 1)
                barrier.wait(timeout=10)
                try:
                    result = user_service.adjust_user_credits(db, self.user_id, -1)
                    return ('success', result.current_credits)
                except user_service.InvalidCreditAdjustment as exc:
                    return ('failure', str(exc))

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(deduct) for _ in range(2)]
            results = [future.result(timeout=20) for future in futures]
        self.assertCountEqual(results, [('success', 0), ('failure', 'Insufficient credits')])
        with SessionLocal() as db:
            self.assertEqual(user_service.get_user(db, self.user_id).credits, 0)


class TransactionFailureTests(unittest.TestCase):
    def test_writes_rollback_and_hide_database_errors(self):
        actions = (
            lambda db: user_service.create_user(db, UserCreate(email='failure@example.com')),
            lambda db: user_service.update_user(db, 1, UserUpdate(email='changed@example.com')),
            lambda db: user_service.deactivate_user(db, 1),
            lambda db: user_service.adjust_user_credits(db, 1, -1),
            lambda db: auth_service.register_user(db, RegisterRequest(
                email='failure@example.com', password='test-only-password')),
        )
        for index, action in enumerate(actions):
            with self.subTest(operation=index):
                db = MagicMock()
                db.scalar.return_value = User(id=1, credits=10)
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
