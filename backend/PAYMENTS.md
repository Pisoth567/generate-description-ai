# PayWay credit purchases

## Readiness and outstanding ABA confirmation

Purchase signing and Check Transaction are implemented from the current official
Developer Suite specifications retrieved on 2026-10-13. No live transaction was
created or checked during implementation. Tests mock all provider HTTP calls.

**Real callbacks are deliberately disabled pending key-provisioning confirmation.**
The official callback example uses `YOUR_SECRET_KEY` but does not identify whether
this is the Purchase API key or a separately provisioned key. The implementation
does not guess either relationship and does not introduce `PAYWAY_CALLBACK_SECRET`.
`get_callback_verification_key()` raises `CallbackKeyUnconfirmed`; otherwise
well-formed signed callbacks therefore receive a safe 503 and cannot grant credits.
Missing or structurally invalid signatures receive 401. With a confirmed key
resolver, incorrect signatures receive 401 as tested.

Ask ABA's integration team for official confirmation of the key used for
`X-PAYWAY-HMAC-SHA512`, how to provision it, and a signature test vector. Then wire
only that documented source into `get_callback_verification_key()`. If ABA confirms
a separate key is required, add its secret setting at that point. Tests currently
patch this resolver with an ephemeral key; they do not prove live interoperability.

The owner-only verify endpoint works independently of callbacks. It can recover
a missed callback using independently checked provider state and atomic crediting.

## Official protocol sources

- [Purchase](https://developer.payway.com.kh/purchase-14530820e0.md): exact HMAC
  sequence in its `hash` field's PHP example. HMAC-SHA512 with the API key, then
  Base64 of the raw digest. Optional parameters not posted contribute no bytes.
  The implementation contains the complete sequence and refuses unsigned fields.
- [Check Transaction](https://developer.payway.com.kh/check-transaction-14530826e0.md):
  its PHP example signs `req_time + merchant_id + tran_id` with the API key.
  The surrounding prose omits `req_time`; this implementation follows the explicit
  code example and required request fields. The response parser follows the
  official Success example, where `status` and `data` are siblings (the schema's
  indentation inconsistently nests `status`). Incompatible responses fail closed.
- [Checkout callback](https://developer.payway.com.kh/ecommerce-checkout-3158159f0.md):
  sorts top-level keys ascending, concatenates scalar values and PHP-default JSON
  encodings of arrays/objects, then applies HMAC-SHA512 and Base64. Comparison is
  constant-time. Nested key order is preserved; Unicode/slashes are escaped as in
  PHP. Ambiguous numeric encodings, oversized integers, duplicate JSON keys,
  non-finite numbers and excessive nesting are rejected. Ordinary monetary decimals
  are supported; values requiring uncertain PHP float rounding/exponent formatting
  fail closed and can use owner verification instead.
- [API access](https://developer.payway.com.kh/api-endpoints-984508m0.md): merchant
  domain/IP whitelist requirements apply.

## Configuration

Configure secrets privately in the ignored `.env`; `.env.example` has no real
credentials. The sandbox base URL is fixed to `https://checkout-sandbox.payway.com.kh`.
Only `PAYWAY_ENV=sandbox` is accepted; production must be introduced explicitly in
a separate change, with separately provisioned credentials and endpoint selection.

Available settings: `PAYWAY_MERCHANT_ID`, `PAYWAY_API_KEY`, `PAYWAY_ENV`,
`PAYWAY_RETURN_URL`, `PAYWAY_CONTINUE_SUCCESS_URL`, `PAYWAY_CANCEL_URL`, and
`PAYWAY_TIMEOUT_SECONDS` (default 15). Optional URLs are omitted when blank and
must use HTTPS when set. A blank return URL uses the merchant profile's default;
setting it does not enable the unresolved callback key resolver.

Localhost cannot receive ABA callbacks. A live sandbox callback needs a publicly
reachable HTTPS endpoint and ABA approval/whitelisting for the return domain and
API access. No tunnel is configured. Do not initiate a live sandbox transaction
without explicit approval.

## API and frontend contract

- `GET /api/payments/packages`: public, database-free trusted catalog:
  starter = USD 1.99 / 100 credits; value = USD 4.99 / 500; pro = USD 9.99 / 1500.
- `POST /api/payments`: JWT required; accepts only `package_code`. Returns 201
  with `payment_id`, `tran_id`, `checkout_url`, and signed `fields`. Amounts are
  Decimal-backed strings. No credits are granted here.
- Submit the returned fields unchanged to `checkout_url` using an HTML POST form
  with `enctype="multipart/form-data"`. The response includes the protocol-required
  merchant identifier and request hash, never the API key or callback key.
  Redirect/success/cancel pages are navigation only, not payment evidence.
- `POST /api/payments/payway/callback`: JSON, no JWT; requires verified
  `X-PAYWAY-HMAC-SHA512` before any provider check or mutation. See blocker above.
- `POST /api/payments/{payment_id}/verify`: authenticated owner recovery.
- `GET /api/payments`: authenticated history, newest first; `skip >= 0`,
  `limit=20`, maximum 100.
- `GET /api/payments/{payment_id}`: owner only; another user's record returns 404,
  as does verifying another user's record.

Creating a checkout multiple times creates multiple independent payment attempts.
Only credit finalization is idempotent, not purchase initiation. Transaction IDs
use 20 hexadecimal characters, 80 random bits, a unique database index, and up to
three attempts on that specific uniqueness violation.

## Accounting and failure behavior

Only Check Transaction reporting both integer `payment_status_code=0` and
`payment_status="APPROVED"` can grant credits. Its echoed transaction ID must match.
`original_amount` (the documented purchase amount before discounts) is compared
as Decimal to the local amount; `payment_currency` must equal the local currency.
Cross-currency payments are not accepted. Callback amount/status/return_params and
client claims never establish payment validity.

The finalizer locks the payment, checks `credited_at`, locks the user, updates
credits and marks paid/credited in one transaction. Duplicate callbacks and manual
verification share this finalizer. No database transaction stays open during the
provider HTTP call. The database enforces unique transaction IDs and consistency
between paid status and credit timestamp. Credit overflow and commit failures
leave the payment uncredited so it can be recovered safely.

Verified DECLINED and CANCELLED states map to failed and cancelled. Pending,
pre-auth, unknown and refunded results never grant credits. Network failures,
provider errors and malformed responses return sanitized 503 responses without
marking an uncertain payment failed. Mismatches return 409 without crediting.
Provider HTTP requests are asynchronous, timeout-bounded, never automatically
retried, and do not follow redirects. Callbacks and provider bodies are size-bounded.
Only optional receipt metadata (`bank_ref`, `apv`, `payment_type`) is retained;
card/account details and raw callback bodies are not stored or logged.

Check Transaction supports transactions created within seven days according to
ABA. Older-payment recovery needs a future Get Transaction Details integration;
no unsupported fallback is attempted here. Refunds, reversals, subscriptions,
stored cards, payouts and pre-authorization are outside this implementation.

## Local verification

Run from `backend`. The existing authentication suite needs a local server:

```bash
source .venv/bin/activate
python -m pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8765 --no-access-log
```

In a second terminal, also from `backend`:

```bash
source .venv/bin/activate
python -m compileall -q app tests alembic
python -m pip check
python -m unittest discover -s tests -v
alembic current
alembic heads
alembic check
git check-ignore .env
git ls-files .env
git diff --check
```

Stop the test server with Ctrl+C afterwards. The tests create isolated PostgreSQL
accounts/payment records and soft-deactivate their accounts during cleanup, matching
the existing suite. They require the migration and mock PayWay and OpenAI.
