"""Run against a local uvicorn server backed by migrated PostgreSQL.

Start: .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8765
Run:   .venv/bin/python -m unittest discover -s tests -v

Only users created by this suite are modified; they are soft-deleted afterward.
Set TEST_API_URL to use a different local server.
"""

import json
import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.db.database import SessionLocal
from app.api.users import user_database
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.services import user_service


BASE_URL = os.environ.get("TEST_API_URL", "http://127.0.0.1:8765")


def request(method, path, data=None):
    body = None if data is None else json.dumps(data).encode()
    req = Request(BASE_URL + path, data=body, method=method,
                  headers={"Content-Type": "application/json"})
    try:
        response = urlopen(req, timeout=15)
    except HTTPError as exc:
        response = exc
    with response:
        raw = response.read().decode()
        result = json.loads(raw) if "application/json" in response.headers.get("Content-Type", "") else raw
        return response.status, result


class UserAPITests(unittest.TestCase):
    def test_user_and_credit_workflow(self):
        created = []
        suffix = uuid4().hex

        def create(email):
            code, user = request("POST", "/api/users", {"email": email})
            self.assertEqual(code, 201, user)
            created.append(user["id"])
            self.assertEqual((user["plan"], user["credits"], user["is_active"]), ("free", 10, True))
            return user

        try:
            # Use the requested example only if it is not an existing account.
            with SessionLocal() as db:
                exists = user_service.get_user_by_email(db, "bro@example.com") is not None
            email = f"bro-{suffix}@example.com" if exists else "bro@example.com"
            user = create(email)
            path = f'/api/users/{user["id"]}'
            self.assertEqual(request("POST", "/api/users", {"email": email.upper()}),
                             (409, {"detail": "Email already exists"}))
            self.assertEqual(request("GET", path)[0], 200)
            code, users = request("GET", "/api/users?skip=0&limit=20")
            self.assertEqual(code, 200)
            self.assertIsInstance(users, list)
            self.assertLessEqual(len(users), 20)
            first = request("GET", "/api/users?skip=0&limit=1")[1]
            second = request("GET", "/api/users?skip=1&limit=1")[1]
            if second:
                self.assertNotEqual(first[0]["id"], second[0]["id"])
            for query in ("skip=-1", "limit=0", "limit=101"):
                self.assertEqual(request("GET", "/api/users?" + query)[0], 422)
            for data in ({"email": "invalid"}, {"email": email, "credits": 100},
                         {"email": email, "plan": "pro"}, {"email": email, "is_active": False}):
                self.assertEqual(request("POST", "/api/users", data)[0], 422)
            for data in ({"credits": 100}, {"plan": "pro"}, {"email": None}, {"is_active": None}):
                self.assertEqual(request("PATCH", path, data)[0], 422)
            updated_email = f"updated-{suffix}@example.com"
            code, updated = request("PATCH", path, {"email": updated_email})
            self.assertEqual(code, 200)
            self.assertEqual(updated["email"], updated_email)
            other = create(f"other-{suffix}@example.com")
            self.assertEqual(request("PATCH", path, {"email": other["email"]})[0], 409)
            self.assertEqual(request("PATCH", path, {})[0], 200)
            for amount, before, after in ((100, 10, 110), (-1, 110, 109)):
                self.assertEqual(request("POST", path + "/credits", {"amount": amount, "reason": "integration test"}),
                                 (200, {"user_id": user["id"], "previous_credits": before,
                                        "adjustment": amount, "current_credits": after}))
            self.assertEqual(request("POST", path + "/credits", {"amount": -110}),
                             (400, {"detail": "Insufficient credits"}))
            self.assertEqual(request("GET", path)[1]["credits"], 109)
            for amount in (0, True, 1.5, "1"):
                self.assertEqual(request("POST", path + "/credits", {"amount": amount})[0], 422)
            self.assertEqual(request("POST", path + "/credits", {"amount": 2**31})[0], 400)
            code, deleted = request("DELETE", path)
            self.assertEqual(code, 200)
            self.assertFalse(deleted["is_active"])
            self.assertEqual(request("GET", path)[0], 200)
            with SessionLocal() as db:
                self.assertFalse(db.get(User, user["id"]).is_active)

            race = create(f"concurrent-{suffix}@example.com")
            race_path = f'/api/users/{race["id"]}'
            self.assertEqual(request("POST", race_path + "/credits", {"amount": -9})[0], 200)
            barrier = Barrier(2)

            def deduct():
                barrier.wait(timeout=10)
                return request("POST", race_path + "/credits", {"amount": -1})

            # Launch both HTTP workers while a PostgreSQL row lock is held.
            with ThreadPoolExecutor(max_workers=2) as pool:
                with SessionLocal() as db:
                    db.scalar(select(User).where(User.id == race["id"]).with_for_update())
                    futures = [pool.submit(deduct) for _ in range(2)]
                    db.commit()
                results = [future.result(timeout=20) for future in futures]
            self.assertEqual(sorted(code for code, _ in results), [200, 400])
            self.assertIn((400, {"detail": "Insufficient credits"}), results)
            self.assertEqual(request("GET", race_path)[1]["credits"], 0)
            print("\nPASS: creation, duplicate, pagination, update, soft delete, +100=110, -1=109, insufficient unchanged; concurrent deductions: 200/400, final=0")

            for method, tail, data in (("GET", "", None), ("PATCH", "", {}),
                                       ("DELETE", "", None), ("POST", "/credits", {"amount": 1})):
                self.assertEqual(request(method, "/api/users/-1" + tail, data)[0], 404)
        finally:
            for user_id in created:
                request("DELETE", f"/api/users/{user_id}")

    def test_existing_endpoints(self):
        for path in ("/", "/health", "/health/database", "/docs"):
            self.assertEqual(request("GET", path)[0], 200)
        self.assertEqual(request("POST", "/api/generate", {
            "product_name": "Test", "category": "demo", "features": ["speed", "quality"]
        }), (200, {"description": "Test is a high-quality demo product featuring speed and quality.",
                  "tone": "professional", "language": "English"}))
        code, schema = request("GET", "/openapi.json")
        self.assertEqual(code, 200)
        self.assertIn("/api/users/{user_id}/credits", schema["paths"])


class TransactionFailureTests(unittest.TestCase):
    def test_writes_rollback_and_hide_database_errors(self):
        for action in (
            lambda db: user_service.create_user(db, UserCreate(email="failure@example.com")),
            lambda db: user_service.update_user(db, 1, UserUpdate(is_active=False)),
            lambda db: user_service.adjust_user_credits(db, 1, -1),
        ):
            db = MagicMock()
            db.scalar.return_value = User(id=1, credits=10)
            with self.subTest(action=action):
                db.commit.side_effect = SQLAlchemyError("private database details")
                # Creation must see an unused email.
                with patch.object(user_service, "get_user_by_email", return_value=None):
                    with self.assertRaisesRegex(user_service.DatabaseFailure, "^Database operation failed$"):
                        action(db)
                db.rollback.assert_called_once()

    def test_duplicate_insert_race_rolls_back(self):
        db = MagicMock()
        db.scalar.return_value = None
        original = MagicMock()
        original.sqlstate = "23505"
        original.diag.constraint_name = "ix_users_email"
        db.commit.side_effect = IntegrityError("private SQL", {}, original)
        with self.assertRaises(user_service.DuplicateEmail):
            user_service.create_user(db, UserCreate(email="race@example.com"))
        db.rollback.assert_called_once()

    def test_database_failure_maps_to_safe_http_500(self):
        dependency = user_database(MagicMock())
        next(dependency)
        with self.assertRaises(HTTPException) as caught:
            dependency.throw(user_service.DatabaseFailure())
        self.assertEqual(caught.exception.status_code, 500)
        self.assertEqual(caught.exception.detail, "Database operation failed")


if __name__ == "__main__":
    unittest.main()
