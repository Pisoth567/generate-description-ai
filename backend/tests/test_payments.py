"""Migrated PostgreSQL integration tests; all PayWay network calls are mocked.

Callback key resolution is patched with an ephemeral test key. Production
resolution deliberately remains disabled pending official ABA confirmation.
"""
import asyncio
import base64
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from decimal import Decimal
import hashlib
import hmac
import json
import secrets
from threading import Barrier
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import event, inspect, select
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings, settings
from app.db.database import SessionLocal, engine
from app.main import app
from app.models.payment import Payment
from app.models.user import User
from app.services import payment_service, payway_service, user_service


def sign(message, key):
    return base64.b64encode(hmac.new(key.encode(), message.encode(), hashlib.sha512).digest()).decode()


class PaymentAPITests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.created = []
        self.addCleanup(self.cleanup_users)
        self.key = secrets.token_urlsafe(48)
        self.callback_key = secrets.token_urlsafe(48)
        for name, value in (("PAYWAY_API_URL", "https://checkout-sandbox.payway.com.kh"), ("PAYWAY_ENV", "sandbox"), ("PAYWAY_MERCHANT_ID", SecretStr("test-merchant")),
                            ("PAYWAY_API_KEY", SecretStr(self.key)), ("PAYWAY_RETURN_URL", ""),
                            ("PAYWAY_CONTINUE_SUCCESS_URL", ""), ("PAYWAY_CANCEL_URL", "")):
            patcher = patch.object(settings, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        patcher = patch.object(payway_service, "get_callback_verification_key", return_value=self.callback_key)
        self.key_resolver = patcher.start()
        self.addCleanup(patcher.stop)
        patcher = patch.object(payway_service, "check_transaction", new_callable=AsyncMock)
        self.check = patcher.start()
        self.addCleanup(patcher.stop)
        self.user, self.headers = self.register()

    def cleanup_users(self):
        with SessionLocal() as db:
            for user_id in self.created:
                user_service.deactivate_user(db, user_id)

    def register(self):
        credentials = {"email": f"payment-{uuid4().hex}@example.com", "password": secrets.token_urlsafe(24)}
        response = self.client.post("/api/auth/register", json=credentials)
        self.assertEqual(response.status_code, 201)
        user = response.json()
        self.created.append(user["id"])
        login = self.client.post("/api/auth/login", json=credentials)
        self.assertEqual(login.status_code, 200)
        return user, {"Authorization": "Bearer " + login.json()["access_token"]}

    def create_payment(self, code="starter", headers=None):
        response = self.client.post("/api/payments", json={"package_code": code},
                                    headers=self.headers if headers is None else headers)
        self.assertEqual(response.status_code, 201)
        return response.json()

    def state(self, credits, count=1):
        with SessionLocal() as db:
            self.assertEqual(db.get(User, self.user["id"]).credits, credits)
            rows = list(db.scalars(select(Payment).where(Payment.user_id == self.user["id"])))
            self.assertEqual(len(rows), count)
            return rows

    def approved(self, checkout):
        return payway_service.TransactionResult(checkout["tran_id"], 0, "APPROVED", Decimal("1.99"), "USD", "123456")

    def callback(self, checkout, *, signature=None, changes=None):
        data = {"tran_id": checkout["tran_id"], "status": "0", "bank_ref": "test-bank-reference",
                "payment_type": "ABA Pay", "return_params": "ignored"}
        if changes:
            data.update(changes)
        raw = json.dumps(data).encode()
        # These test fields are strings, matching PHP's scalar concatenation.
        signed = sign("".join(data[k] for k in sorted(data)), self.callback_key)
        return self.client.post("/api/payments/payway/callback", content=raw,
                                headers={"Content-Type": "application/json", "X-PAYWAY-HMAC-SHA512":
                                         signed if signature is None else signature})

    def test_packages_without_database(self):
        with patch.object(engine, "connect", side_effect=AssertionError("No database needed")):
            response = self.client.get("/api/payments/packages")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [
            {"code": "starter", "amount": "1.99", "currency": "USD", "credits": 100},
            {"code": "value", "amount": "4.99", "currency": "USD", "credits": 500},
            {"code": "pro", "amount": "9.99", "currency": "USD", "credits": 1500},
        ])

    def test_create_trusted_package_signed_checkout_no_credit(self):
        checkout = self.create_payment()
        row = self.state(10)[0]
        self.assertEqual((row.amount, row.currency, row.credits, row.status), (Decimal("1.99"), "USD", 100, "pending"))
        self.assertEqual(row.tran_id, checkout["tran_id"])
        self.assertRegex(row.tran_id, r"^[a-f0-9]{20}$")
        self.assertIsNone(row.credited_at)
        self.assertEqual(checkout["checkout_url"], "https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase")
        fields = checkout["fields"]
        self.assertEqual(set(fields), {"req_time", "merchant_id", "tran_id", "amount", "currency", "return_params", "hash"})
        self.assertEqual(fields["amount"], "1.99")
        self.assertEqual(json.loads(fields["return_params"]), {"payment_id": row.id})
        preimage = fields["req_time"] + "test-merchant" + row.tran_id + "1.99USD" + fields["return_params"]
        self.assertTrue(hmac.compare_digest(fields["hash"], sign(preimage, self.key)))
        self.assertFalse(self.key in json.dumps(checkout))
        self.check.assert_not_called()

    def test_configured_checkout_url(self):
        with patch.object(settings, "PAYWAY_API_URL", "https://payway.example/gateway///"):
            checkout = self.create_payment()
        self.assertEqual(checkout["checkout_url"],
                         "https://payway.example/gateway/api/payment-gateway/v1/payments/purchase")
        self.check.assert_not_called()

    def test_invalid_api_url_is_sanitized_and_rolls_back(self):
        with patch.object(settings, "PAYWAY_API_URL", "https://user:private@payway.example/#private"):
            response = self.client.post("/api/payments", json={"package_code": "starter"}, headers=self.headers)
        self.assertEqual((response.status_code, response.json()),
                         (503, {"detail": "Payment provider is temporarily unavailable"}))
        self.state(10, 0)
        self.check.assert_not_called()

    def test_all_packages_and_unique_ids(self):
        for code, amount, credits in (("starter", "1.99", 100), ("value", "4.99", 500), ("pro", "9.99", 1500)):
            checkout = self.create_payment(code)
            with SessionLocal() as db:
                row = db.get(Payment, checkout["payment_id"])
                self.assertEqual((row.amount, row.credits), (Decimal(amount), credits))
        rows = self.state(10, 3)
        self.assertEqual(len({p.tran_id for p in rows}), 3)

    def test_invalid_package_and_client_overrides_rejected(self):
        for payload in ({"package_code": "fake"}, {"package_code": "STARTER"}, {},
                        {"package_code": "starter", "amount": "0.01"},
                        {"package_code": "starter", "credits": 999999},
                        {"package_code": "starter", "currency": "KHR"},
                        {"package_code": "starter", "user_id": 1},
                        {"package_code": "starter", "api_url": "https://client.example"},
                        {"package_code": "starter", "checkout_url": "https://client.example"}):
            with self.subTest(payload=payload):
                response = self.client.post("/api/payments", json=payload, headers=self.headers)
                self.assertEqual(response.status_code, 422)
        self.state(10, 0)
        self.check.assert_not_called()

    def test_create_missing_configuration_rolls_back(self):
        with patch.object(settings, "PAYWAY_API_KEY", None):
            response = self.client.post("/api/payments", json={"package_code": "starter"}, headers=self.headers)
        self.assertEqual(response.status_code, 503)
        self.state(10, 0)

    def test_id_collision_retry_and_exhaustion(self):
        first = self.create_payment()
        with patch.object(payment_service, "new_tran_id", side_effect=[first["tran_id"], secrets.token_hex(10)]):
            second = self.create_payment()
        self.assertNotEqual(first["tran_id"], second["tran_id"])
        with patch.object(payment_service, "new_tran_id", return_value=first["tran_id"]):
            response = self.client.post("/api/payments", json={"package_code": "starter"}, headers=self.headers)
        self.assertEqual(response.status_code, 500)
        self.state(10, 2)

    def test_valid_callback_without_jwt_approved_and_duplicate(self):
        checkout = self.create_payment()
        self.check.return_value = self.approved(checkout)
        timestamps = []
        for _ in range(10):
            self.assertEqual(self.callback(checkout).status_code, 200)
            row = self.state(110)[0]
            self.assertEqual(row.status, "paid")
            self.assertIsNotNone(row.credited_at)
            self.assertIsNotNone(row.paid_at.tzinfo)
            timestamps.append(row.credited_at)
        self.assertEqual(len(set(timestamps)), 1)
        self.assertEqual((row.bank_ref, row.apv, row.payment_type), ("test-bank-reference", "123456", "ABA Pay"))
        self.check.assert_awaited_once_with(checkout["tran_id"])

    def test_callback_invalid_missing_and_modified_signature(self):
        checkout = self.create_payment()
        data = {"tran_id": checkout["tran_id"], "status": "0"}
        signature = sign("0" + checkout["tran_id"], self.callback_key)
        for supplied, body in (("", data), ("x" * 88, data), (signature, {**data, "status": "1"})):
            response = self.client.post("/api/payments/payway/callback", json=body,
                                        headers={"X-PAYWAY-HMAC-SHA512": supplied} if supplied else {})
            self.assertEqual(response.status_code, 401)
        self.check.assert_not_called()
        self.assertEqual(self.state(10)[0].status, "pending")

    def test_unconfirmed_callback_key_fails_closed(self):
        checkout = self.create_payment()
        self.key_resolver.side_effect = payway_service.CallbackKeyUnconfirmed()
        self.assertEqual(self.callback(checkout).status_code, 503)
        self.check.assert_not_called()
        self.state(10)

    def test_callback_limits_and_json(self):
        self.create_payment()
        headers = {"Content-Type": "application/json", "X-PAYWAY-HMAC-SHA512": sign("unused", self.callback_key)}
        for raw in (b"not-json", b"[]", b'{"status":0,"status":1}', b'{"n":NaN}', b'"x"'):
            self.assertEqual(self.client.post("/api/payments/payway/callback", content=raw, headers=headers).status_code, 401)
        self.assertEqual(self.client.post("/api/payments/payway/callback", content=b"x" * 65537, headers=headers).status_code, 413)
        self.assertEqual(self.client.post("/api/payments/payway/callback", content=b"{}",
                                         headers={**headers, "Content-Type": "text/plain"}).status_code, 415)
        self.check.assert_not_called()
        self.state(10)

    def test_amount_currency_and_transaction_mismatches(self):
        checkout = self.create_payment()
        for changes in ({"amount": Decimal("0.99")}, {"currency": "KHR"}, {"tran_id": "wrong"}):
            with self.subTest(changes=changes):
                self.check.return_value = replace(self.approved(checkout), **changes)
                self.assertEqual(self.callback(checkout).status_code, 409)
                row = self.state(10)[0]
                self.assertEqual(row.status, "pending")
                self.assertIsNone(row.credited_at)

    def test_unapproved_states_and_callback_claims_never_credit(self):
        for code, state, local in ((2, "PENDING", "pending"), (0, "PRE-AUTH", "pending"),
                                   (99, "UNKNOWN", "pending"), (3, "DECLINED", "failed"),
                                   (7, "CANCELLED", "cancelled"), (4, "REFUNDED", "pending"),
                                   (2, "APPROVED", "pending")):
            with self.subTest(state=state):
                checkout = self.create_payment()
                self.check.return_value = payway_service.TransactionResult(checkout["tran_id"], code, state, None, None)
                self.assertEqual(self.callback(checkout).status_code, 200)
                with SessionLocal() as db:
                    row = db.get(Payment, checkout["payment_id"])
                    self.assertEqual(row.status, local)
                    self.assertIsNone(row.credited_at)
                    self.assertEqual(db.get(User, self.user["id"]).credits, 10)

    def test_provider_failure_preserves_pending(self):
        checkout = self.create_payment()
        self.check.side_effect = payway_service.PayWayUnavailable()
        for response in (self.callback(checkout), self.client.post(f'/api/payments/{checkout["payment_id"]}/verify', headers=self.headers)):
            self.assertEqual((response.status_code, response.json()), (503, {"detail": "Payment provider is temporarily unavailable"}))
        row = self.state(10)[0]
        self.assertEqual(row.status, "pending")
        self.assertIsNone(row.credited_at)

    def test_manual_recovery_and_duplicate(self):
        checkout = self.create_payment()
        self.check.return_value = self.approved(checkout)
        for _ in range(2):
            response = self.client.post(f'/api/payments/{checkout["payment_id"]}/verify', headers=self.headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["status"], "paid")
        self.state(110)
        self.assertEqual(self.callback(checkout).status_code, 200)
        self.state(110)

    def test_concurrent_callbacks_and_manual_verify(self):
        for manual in (False, True):
            with self.subTest(manual=manual):
                checkout = self.create_payment()
                barrier = Barrier(2)
                async def check(tran_id):
                    await asyncio.to_thread(barrier.wait, 10)
                    return self.approved(checkout)
                self.check.side_effect = check
                with ThreadPoolExecutor(max_workers=2) as pool:
                    first = pool.submit(self.callback, checkout)
                    second = (pool.submit(self.client.post, f'/api/payments/{checkout["payment_id"]}/verify', headers=self.headers)
                              if manual else pool.submit(self.callback, checkout))
                    responses = [first.result(timeout=20), second.result(timeout=20)]
                self.assertEqual([r.status_code for r in responses], [200, 200])
                self.state(210 if manual else 110, 2 if manual else 1)

    def test_commit_failure_rolls_back_credit_and_payment(self):
        checkout = self.create_payment()
        self.check.return_value = self.approved(checkout)
        def fail_commit(session):
            raise SQLAlchemyError("private database failure")
        event.listen(SessionLocal.class_, "before_commit", fail_commit)
        try:
            response = self.callback(checkout)
        finally:
            event.remove(SessionLocal.class_, "before_commit", fail_commit)
        self.assertEqual(response.status_code, 500)
        row = self.state(10)[0]
        self.assertEqual(row.status, "pending")
        self.assertIsNone(row.credited_at)
        self.assertEqual(self.callback(checkout).status_code, 200)
        self.state(110)

    def test_balance_overflow_no_partial_credit(self):
        checkout = self.create_payment()
        with SessionLocal() as db:
            db.get(User, self.user["id"]).credits = 2_147_483_600
            db.commit()
        self.check.return_value = self.approved(checkout)
        self.assertEqual(self.callback(checkout).status_code, 409)
        self.assertIsNone(self.state(2_147_483_600)[0].credited_at)

    def test_history_ownership_auth_and_pagination(self):
        ids = [self.create_payment()["payment_id"] for _ in range(3)]
        other, other_headers = self.register()
        other_payment = self.create_payment(headers=other_headers)
        response = self.client.get("/api/payments", headers=self.headers)
        self.assertEqual([row["id"] for row in response.json()], ids[::-1])
        self.assertEqual(set(response.json()[0]), {"id", "tran_id", "package_code", "amount", "currency", "credits",
                                                  "status", "bank_ref", "payment_type", "created_at", "paid_at"})
        page = self.client.get("/api/payments?skip=1&limit=1", headers=self.headers)
        self.assertEqual([p["id"] for p in page.json()], [ids[1]])
        for payment_id in (other_payment["payment_id"], 2147483647):
            for method, suffix in (("GET", ""), ("POST", "/verify")):
                response = self.client.request(method, f"/api/payments/{payment_id}{suffix}", headers=self.headers)
                self.assertEqual(response.status_code, 404)
        for query in ("skip=-1", "limit=0", "limit=101"):
            self.assertEqual(self.client.get("/api/payments?" + query, headers=self.headers).status_code, 422)
        for method, path in (("GET", "/api/payments"), ("POST", "/api/payments"),
                             ("GET", f"/api/payments/{ids[0]}"), ("POST", f"/api/payments/{ids[0]}/verify")):
            self.assertEqual(self.client.request(method, path, json={"package_code": "starter"}).status_code, 401)
        self.check.assert_not_called()

    def test_migrated_table_constraints(self):
        inspector = inspect(engine)
        self.assertTrue(inspector.has_table("payments"))
        indexes = inspector.get_indexes("payments")
        self.assertTrue(any(i["unique"] and i["column_names"] == ["tran_id"] for i in indexes))
        self.assertTrue(any(i["column_names"] == ["user_id"] for i in indexes))
        foreign_keys = inspector.get_foreign_keys("payments")
        self.assertTrue(any(f["constrained_columns"] == ["user_id"] and f["referred_table"] == "users"
                            and f["referred_columns"] == ["id"] for f in foreign_keys))


class PayWayProtocolTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.key = secrets.token_urlsafe(48)
        for name, value in (("PAYWAY_API_URL", "https://checkout-sandbox.payway.com.kh"), ("PAYWAY_ENV", "sandbox"), ("PAYWAY_API_KEY", SecretStr(self.key)),
                            ("PAYWAY_MERCHANT_ID", SecretStr("test-merchant"))):
            patcher = patch.object(settings, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_default_and_normalized_api_urls(self):
        default = "https://checkout-sandbox.payway.com.kh"
        self.assertEqual(Settings.model_fields["PAYWAY_API_URL"].default, default)
        for base in (default, "https://payway.example/gateway"):
            for suffix in ("", "/", "///"):
                with self.subTest(base=base, suffix=suffix), patch.object(settings, "PAYWAY_API_URL", base + suffix):
                    self.assertEqual(payway_service.purchase_url(), base + "/api/payment-gateway/v1/payments/purchase")
                    self.assertEqual(payway_service.check_url(), base + "/api/payment-gateway/v1/payments/check-transaction-2")

    async def test_invalid_api_urls_fail_before_network(self):
        for url in ("", "http://payway.example", "https:///missing", "https://",
                    "https://user@payway.example", "https://user:password@payway.example",
                    "https://@payway.example", "https://:password@payway.example",
                    "https://payway.example/#fragment", "https://payway.example/#",
                    "https://payway.example/?query", "https://payway.example:bad",
                    "https://payway.example:65536", "https://[invalid", "https://payway.example/\n"):
            with self.subTest(url=url), patch.object(settings, "PAYWAY_API_URL", url):
                with patch.object(payway_service.httpx, "AsyncClient") as client:
                    for get_url in (payway_service.purchase_url, payway_service.check_url):
                        with self.assertRaisesRegex(payway_service.PayWayUnavailable,
                                                    "^Payment provider is temporarily unavailable$"):
                            get_url()
                    with self.assertRaises(payway_service.PayWayUnavailable):
                        await payway_service.check_transaction("abc123")
                    client.assert_not_called()

    async def test_custom_check_url_uses_mock_transport(self):
        seen = []
        def handler(request):
            seen.append(request)
            self.assertEqual(str(request.url),
                             "https://payway.example/gateway/api/payment-gateway/v1/payments/check-transaction-2")
            return httpx.Response(200, json={"status": {"code": "00", "tran_id": "abc123"},
                                            "data": {"payment_status_code": 2, "payment_status": "PENDING"}})
        with patch.object(settings, "PAYWAY_API_URL", "https://payway.example/gateway/"):
            await self.provider_call(handler)
        self.assertEqual(len(seen), 1)

    def test_official_purchase_and_check_hash_recipes(self):
        with patch.object(payway_service, "_request_time", return_value="20261013000000"), \
             patch.object(settings, "PAYWAY_RETURN_URL", "https://merchant.example/callback"), \
             patch.object(settings, "PAYWAY_CANCEL_URL", "https://merchant.example/cancel"), \
             patch.object(settings, "PAYWAY_CONTINUE_SUCCESS_URL", "https://merchant.example/success"):
            fields = payway_service.build_purchase_fields("0123456789abcdef0123", Decimal("1.99"), "USD", 42)
        return_url = base64.b64encode(b"https://merchant.example/callback").decode()
        message = ('20261013000000test-merchant0123456789abcdef01231.99' + return_url
                   + 'https://merchant.example/cancelhttps://merchant.example/successUSD{"payment_id":42}')
        self.assertTrue(hmac.compare_digest(fields["hash"], sign(message, self.key)))
        self.assertEqual(fields["return_url"], return_url)
        with patch.object(payway_service, "_request_time", return_value="20261013000000"):
            check = payway_service.build_check_fields("0123456789abcdef0123")
        self.assertTrue(hmac.compare_digest(check["hash"], sign("20261013000000test-merchant0123456789abcdef0123", self.key)))
        with self.assertRaises(payway_service.PayWayUnavailable):
            payway_service.purchase_hash({"unsigned_field": "data"}, self.key)

    def test_callback_php_nested_serialization_and_signature(self):
        raw = '{"tran_id":"abc123","z":null,"amount":1.99,"metadata":{"z":"ក/","a":[true,false,null,1.0,{}]},"status":"0"}'.encode()
        # PHP ksort sorts only top-level keys; json_encode escapes Unicode/slashes,
        # keeps inner order, removes .0, and converts decoded empty objects to [].
        message = '1.99{"z":"\\u1780\\/","a":[true,false,null,1,[]]}0abc123'
        with patch.object(payway_service, "get_callback_verification_key", return_value=self.key):
            result = payway_service.verify_callback(raw, sign(message, self.key))
        self.assertEqual(result["tran_id"], "abc123")
        self.assertEqual(payway_service.callback_signing_message({"a": {"0": "x", "1": "y"}}), '["x","y"]')
        self.assertEqual(payway_service.callback_signing_message({"a": True, "b": False, "c": None}), "1")
        for raw in (b'{"tran_id":"x","n":1e100}', b'{"tran_id":"x","n":0.123456789012345}',
                    b'{"tran_id":"x","n":9223372036854775808}'):
            with self.assertRaises(payway_service.InvalidCallback):
                payway_service.verify_callback(raw, sign("unused", self.key))

    def test_callback_key_is_not_assumed_from_api_key(self):
        with self.assertRaises(payway_service.CallbackKeyUnconfirmed):
            payway_service.get_callback_verification_key()

    async def provider_call(self, handler):
        real_client = httpx.AsyncClient
        def client(**kwargs):
            self.assertEqual(kwargs["timeout"], settings.PAYWAY_TIMEOUT_SECONDS)
            self.assertFalse(kwargs["follow_redirects"])
            return real_client(transport=httpx.MockTransport(handler), **kwargs)
        with patch.object(payway_service.httpx, "AsyncClient", side_effect=client):
            return await payway_service.check_transaction("abc123")

    async def test_check_transport_and_decimal_response(self):
        seen = []
        def handler(request):
            seen.append(request)
            self.assertEqual(str(request.url), "https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/check-transaction-2")
            self.assertEqual(request.method, "POST")
            fields = json.loads(request.content)
            self.assertEqual(set(fields), {"req_time", "merchant_id", "tran_id", "hash"})
            self.assertTrue(hmac.compare_digest(fields["hash"], sign(fields["req_time"] + "test-merchantabc123", self.key)))
            return httpx.Response(200, content=b'{"status":{"code":"00","tran_id":"abc123"},"data":'
                                  b'{"payment_status_code":0,"payment_status":"APPROVED","original_amount":1.99,'
                                  b'"payment_amount":1.99,"payment_currency":"USD","apv":"123456"}}')
        result = await self.provider_call(handler)
        self.assertTrue(result.approved)
        self.assertIs(type(result.amount), Decimal)
        self.assertEqual(result.amount, Decimal("1.99"))
        self.assertEqual(len(seen), 1)

    async def test_timeout_connection_5xx_and_bad_responses_sanitized_no_retry(self):
        for kind in ("timeout", "connection", "5xx", "redirect", "bad-json", "oversize", "bad-schema", "not-found"):
            with self.subTest(kind=kind):
                seen = []
                def handler(request):
                    seen.append(True)
                    if kind == "timeout":
                        raise httpx.ReadTimeout("private provider details", request=request)
                    if kind == "connection":
                        raise httpx.ConnectError("private provider details", request=request)
                    if kind == "5xx":
                        return httpx.Response(500, text="private provider details")
                    if kind == "redirect":
                        return httpx.Response(302, headers={"Location": "https://untrusted.example"})
                    if kind == "oversize":
                        return httpx.Response(200, content=b"x" * 65537)
                    if kind == "not-found":
                        return httpx.Response(200, json={"status": {"code": 6}})
                    return httpx.Response(200, content=b"{}" if kind == "bad-schema" else b"invalid")
                with self.assertRaisesRegex(payway_service.PayWayUnavailable, "^Payment provider is temporarily unavailable$"):
                    await self.provider_call(handler)
                self.assertEqual(len(seen), 1)

    def test_approved_parser_rejects_missing_malformed_and_nonfinite_amount(self):
        base = {"status": {"code": "00", "tran_id": "abc123"}, "data": {
            "payment_status_code": 0, "payment_status": "APPROVED", "original_amount": "1.99", "payment_currency": "USD"}}
        for amount in (None, True, "NaN", "Infinity", "-1", "invalid"):
            data = {**base, "data": {**base["data"], "original_amount": amount}}
            with self.assertRaises(payway_service.PayWayUnavailable):
                payway_service.parse_transaction(json.dumps(data).encode())


if __name__ == "__main__":
    unittest.main()
