"""PayWay protocol boundary. Never log payloads, signatures or provider errors.

Official sources (retrieved 2026-10-13):
https://developer.payway.com.kh/purchase-14530820e0.md
https://developer.payway.com.kh/check-transaction-14530826e0.md
https://developer.payway.com.kh/ecommerce-checkout-3158159f0.md
"""
import base64
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import hmac
import json
import re
from urllib.parse import urlsplit

import httpx

from app.core.config import settings

BASE_URL = "https://checkout-sandbox.payway.com.kh"
PURCHASE_URL = BASE_URL + "/api/payment-gateway/v1/payments/purchase"
CHECK_URL = BASE_URL + "/api/payment-gateway/v1/payments/check-transaction-2"
MAX_CALLBACK_BYTES = 64 * 1024
MAX_RESPONSE_BYTES = 64 * 1024

# Exact order from the official Purchase hash PHP example. Omitted optional
# fields contribute no bytes. Refuse fields outside this signed sequence.
PURCHASE_HASH_FIELDS = (
    "req_time", "merchant_id", "tran_id", "amount", "items", "shipping",
    "firstname", "lastname", "email", "phone", "type", "payment_option",
    "return_url", "cancel_url", "continue_success_url", "return_deeplink",
    "currency", "custom_fields", "return_params", "payout", "lifetime",
    "additional_params", "google_pay_token", "skip_success_page",
)


class PayWayUnavailable(Exception):
    def __init__(self):
        super().__init__("Payment provider is temporarily unavailable")


class CallbackKeyUnconfirmed(PayWayUnavailable):
    """Blocked until ABA identifies the callback key's provisioning/source."""


class InvalidCallback(Exception):
    pass


def _signature(message: str, key: str) -> str:
    return base64.b64encode(hmac.new(key.encode(), message.encode(), hashlib.sha512).digest()).decode("ascii")


def _credentials() -> tuple[str, str]:
    if settings.PAYWAY_ENV != "sandbox":
        raise PayWayUnavailable()
    merchant = settings.PAYWAY_MERCHANT_ID
    key = settings.PAYWAY_API_KEY
    if not merchant or not key:
        raise PayWayUnavailable()
    merchant_value, key_value = merchant.get_secret_value(), key.get_secret_value()
    if not merchant_value.strip() or len(merchant_value) > 30 or not key_value.strip():
        raise PayWayUnavailable()
    return merchant_value, key_value


def _request_time() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def _trusted_url(value: str) -> str:
    # URLs come only from backend configuration. Never accept a caller's URL.
    try:
        parsed = urlsplit(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
            raise ValueError
    except ValueError:
        raise PayWayUnavailable() from None
    return value


def purchase_hash(fields: dict[str, str], key: str) -> str:
    if set(fields) - set(PURCHASE_HASH_FIELDS) or any(not isinstance(v, str) for v in fields.values()):
        raise PayWayUnavailable()
    return _signature("".join(fields.get(name, "") for name in PURCHASE_HASH_FIELDS), key)


def build_purchase_fields(tran_id: str, amount: Decimal, currency: str, payment_id: int) -> dict[str, str]:
    merchant, key = _credentials()
    if not re.fullmatch(r"[A-Za-z0-9]{1,20}", tran_id) or currency != "USD" or amount <= 0:
        raise PayWayUnavailable()
    fields = {
        "req_time": _request_time(), "merchant_id": merchant, "tran_id": tran_id,
        "amount": format(amount, ".2f"), "currency": currency,
        "return_params": json.dumps({"payment_id": payment_id}, separators=(",", ":")),
    }
    if settings.PAYWAY_RETURN_URL:
        fields["return_url"] = base64.b64encode(_trusted_url(settings.PAYWAY_RETURN_URL).encode()).decode("ascii")
    for name, value in (("cancel_url", settings.PAYWAY_CANCEL_URL),
                        ("continue_success_url", settings.PAYWAY_CONTINUE_SUCCESS_URL)):
        if value:
            fields[name] = _trusted_url(value)
    fields["hash"] = purchase_hash(fields, key)
    return fields


def build_check_fields(tran_id: str) -> dict[str, str]:
    merchant, key = _credentials()
    fields = {"req_time": _request_time(), "merchant_id": merchant, "tran_id": tran_id}
    # Separate official Check Transaction recipe, including req_time as in PHP.
    fields["hash"] = _signature(fields["req_time"] + merchant + tran_id, key)
    return fields


def get_callback_verification_key() -> str:
    # The official example says YOUR_SECRET_KEY without identifying its source.
    # Do NOT assume PAYWAY_API_KEY, or invent a separate configuration secret.
    # Replace this resolver only after obtaining official ABA confirmation.
    raise CallbackKeyUnconfirmed()


def _no_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _invalid_constant(value):
    raise ValueError("Non-finite JSON number")


def _json(raw: bytes):
    return json.loads(raw.decode("utf-8"), parse_float=Decimal,
                      parse_constant=_invalid_constant, object_pairs_hook=_no_duplicates)


def _callback_number(value: Decimal) -> str:
    # PHP scalar float coercion depends on precision; avoid ambiguous rounding
    # or exponent formatting. Normal monetary decimals fit this exact subset.
    normalized = value.normalize()
    if (not value.is_finite() or len(normalized.as_tuple().digits) > 14
            or (value and not Decimal("0.0001") <= abs(value) < Decimal("1e14"))):
        raise InvalidCallback()
    if value.is_zero() and value.is_signed():
        return "-0"
    return format(normalized, "f")


def _php_json(value, depth=0) -> str:
    """PHP json_decode(..., true) then default json_encode, not recursive sorting.

    Unicode and slashes are escaped. Associative empty objects become arrays;
    sequential numeric keys become arrays too. Unsupported numbers fail closed.
    """
    if depth > 20:
        raise InvalidCallback()
    if isinstance(value, dict):
        keys = list(value)
        if keys == [str(i) for i in range(len(keys))]:
            return _php_json(list(value.values()), depth + 1)
        return "{" + ",".join(_php_json(k, depth + 1) + ":" + _php_json(v, depth + 1)
                              for k, v in value.items()) + "}"
    if isinstance(value, list):
        return "[" + ",".join(_php_json(v, depth + 1) for v in value) + "]"
    if isinstance(value, Decimal):
        return _callback_number(value)
    if isinstance(value, str):
        value.encode("utf-8")  # PHP rejects unpaired Unicode surrogates.
    if type(value) is int and not -(2**63) <= value < 2**63:
        raise InvalidCallback()
    return json.dumps(value, ensure_ascii=True, separators=(",", ":"), allow_nan=False).replace("/", "\\/")


def callback_signing_message(payload: dict) -> str:
    values = []
    for name in sorted(payload):
        # Official callback keys are ASCII identifiers; reject ambiguous PHP
        # numeric-key sorting rather than silently sign with another ordering.
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
            raise InvalidCallback()
        value = payload[name]
        if isinstance(value, (dict, list)):
            values.append(_php_json(value))
        elif value is None or value is False:
            values.append("")
        elif value is True:
            values.append("1")
        elif isinstance(value, Decimal):
            values.append(_callback_number(value))
        elif type(value) is int:
            if not -(2**63) <= value < 2**63:
                raise InvalidCallback()
            values.append(str(value))
        elif isinstance(value, str):
            values.append(value)
        else:
            raise InvalidCallback()
    return "".join(values)


def verify_callback(raw: bytes, signature: str | None) -> dict:
    if not signature or len(signature) != 88 or not signature.isascii() or len(raw) > MAX_CALLBACK_BYTES:
        raise InvalidCallback()
    try:
        if len(base64.b64decode(signature, validate=True)) != 64:
            raise InvalidCallback()
        payload = _json(raw)
        if not isinstance(payload, dict) or not payload:
            raise InvalidCallback()
        message = callback_signing_message(payload)
        message.encode("utf-8")
    except (ValueError, TypeError, RecursionError, UnicodeError, InvalidOperation):
        raise InvalidCallback() from None
    expected = _signature(message, get_callback_verification_key())
    if not hmac.compare_digest(expected, signature):
        raise InvalidCallback()
    if not isinstance(payload.get("tran_id"), str) or not re.fullmatch(r"[A-Za-z0-9]{1,20}", payload["tran_id"]):
        raise InvalidCallback()
    return payload


@dataclass(frozen=True)
class TransactionResult:
    tran_id: str
    status_code: int
    status: str
    amount: Decimal | None
    currency: str | None
    apv: str | None = None
    bank_ref: str | None = None
    payment_type: str | None = None

    @property
    def approved(self) -> bool:
        return type(self.status_code) is int and self.status_code == 0 and self.status == "APPROVED"


def safe_metadata(value) -> str | None:
    return value if isinstance(value, str) and 0 < len(value) <= 128 else None


def parse_transaction(raw: bytes) -> TransactionResult:
    try:
        body = _json(raw)
        # Follow the official Success example: status and data are siblings.
        status, data = body["status"], body["data"]
        if status["code"] != "00" or not isinstance(status["tran_id"], str):
            raise ValueError
        code, state = data["payment_status_code"], data["payment_status"]
        if type(code) is not int or not isinstance(state, str):
            raise ValueError
        amount = None
        currency = data.get("payment_currency")
        if code == 0 and state == "APPROVED":
            # original_amount is the purchase amount, not discounted payment_amount.
            value = data["original_amount"]
            if type(value) not in (str, int, Decimal):
                raise ValueError
            amount = Decimal(value)
            if not amount.is_finite() or amount <= 0 or not isinstance(currency, str):
                raise ValueError
        return TransactionResult(status["tran_id"], code, state, amount, currency,
                                 safe_metadata(data.get("apv")), safe_metadata(data.get("bank_ref")),
                                 safe_metadata(data.get("payment_type")))
    except (KeyError, ValueError, TypeError, RecursionError, InvalidOperation, UnicodeError):
        raise PayWayUnavailable() from None


async def check_transaction(tran_id: str) -> TransactionResult:
    fields = build_check_fields(tran_id)
    try:
        # No automatic retries; never follow redirects with signed credentials.
        async with httpx.AsyncClient(timeout=settings.PAYWAY_TIMEOUT_SECONDS, follow_redirects=False) as client:
            async with client.stream("POST", CHECK_URL, json=fields) as response:
                response.raise_for_status()
                raw = bytearray()
                async for chunk in response.aiter_bytes():
                    raw.extend(chunk)
                    if len(raw) > MAX_RESPONSE_BYTES:
                        raise PayWayUnavailable()
        return parse_transaction(bytes(raw))
    except httpx.HTTPError:
        raise PayWayUnavailable() from None
