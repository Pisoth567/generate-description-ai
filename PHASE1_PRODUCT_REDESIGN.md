> Historical Phase 1 record. Current product behavior and setup are documented in [Phase 2](PHASE2_PRODUCT_SIMPLIFICATION.md).

# Phase 1 product redesign

The active product is a free AI Product Description Generator. Email/password and Google sign-in feed an authenticated Generate → History → Profile workflow. Existing users, descriptions, passwords, Google subjects, credits, and payment records are retained. No commit, push, deployment, live email, live OAuth, OpenAI API call, or PayWay transaction is part of this change.

## Architecture and routes

The browser calls same-origin Next.js BFF handlers. The application JWT stays in an HttpOnly, SameSite=Lax cookie (Secure in production); it is attached to backend calls only on the server. Mutation origin checks remain enabled. Protected pages remain noindex. Users cannot choose another account's identity or read its history.

Active pages: `/`, `/register`, `/login`, `/verify-email`, `/generate`, `/history`, `/history/[id]`, `/profile`. `/dashboard`, `/pricing`, `/payments`, and `/payments/return` redirect to `/generate`; `/account` redirects to `/profile`. Google linking returns to `/profile`.

New auth endpoints: `POST /api/auth/verify-email`, `POST /api/auth/resend-verification`, and authenticated `POST /api/auth/preferences`. Registration returns an unverified user, never a session. A correct password on an unverified account returns HTTP 403 with application code `email_verification_required`; protected backend dependencies also reject such accounts. Verification does not authenticate automatically: the user signs in afterward.

`PAYMENTS_ENABLED=false` is the backend default. Payment routes, including callback, are not registered. Payment code, models, tables, BFF files and legacy components remain for rollback/Phase 2. Legacy payment tests explicitly construct a separate test application. Retired payment/browser-flow expectations are archived under `frontend/tests/legacy/`; the active browser suite checks redirects and the new flows.

## Migration and existing users

Revision `e10a1b2c3d40`, parent `7b81e2ac940d`, adds:

- `users.email_verified_at`, nullable timezone-aware timestamp with **no default**.
- `users.ui_language`, non-null `en` by default; API permits only `en` and `km`.
- `email_verification_codes`, one current challenge per user with a keyed digest, timestamps and failed-attempt count.
- `generation_attempts`, indexed per-account attempt timestamps.

The upgrade backfills verification only for existing Google-linked accounts (`google_sub IS NOT NULL`), whose original linking/sign-in flow required a verified Google identity. Existing password-only accounts remain unverified and must use the email verification/resend flow before sign-in. No account, password hash, generation, credit balance or payment is removed. The migration does not alter `is_active`; inactive accounts remain inactive. New password registrations have a null verification timestamp. Google-created users receive a timestamp only after verified signed claims. This corrects the inherited draft migration, which incorrectly marked all legacy inboxes verified.

The downgrade removes only Phase 1 tables/columns; it keeps users, generations, credits and payments. It loses Phase 1 verification/preferences/limiter state, so it is a rollback operation, not routine maintenance. Tests exercise upgrade, backfill, new-user null default, schema parity, and downgrade in a disposable schema. The configured existing application database was not migrated during this work.

## Email verification and delivery

Codes are generated with `secrets.randbelow`, formatted as exactly six digits, and digested with HMAC-SHA256 using a dedicated `EMAIL_VERIFICATION_SECRET` and the user ID as context. Only the digest reaches PostgreSQL. Codes expire after ten minutes, allow at most five incorrect checks, and are consumed on success. Reissue has a 60-second cooldown and overwrites the previous challenge, invalidating it. Parent-user row locks serialize verify/resend operations across workers; failed attempts commit before an error is returned. Unknown, verified, inactive, and cooldown resend requests receive the same normal response. Incorrect, expired, consumed, locked-out and unknown verification requests share a safe error. Neither API responses nor logs contain codes.

`email_service.send_verification` is the mockable delivery boundary. A focused Resend adapter is provided; no Gmail credentials or fake console delivery. To enable real delivery later:

1. Configure a transactional Resend account and verify a sender domain with its required DNS records.
2. Set `EMAIL_PROVIDER=resend` and `EMAIL_FROM` to an approved sender.
3. Store the provider key in server-only `EMAIL_API_KEY`.
4. Set an independent, cryptographically random `EMAIL_VERIFICATION_SECRET` of at least 32 bytes in the backend secret store. Do not reuse the JWT secret. Rotating it invalidates outstanding codes.
5. Deploy the reviewed migration and configure transport/monitoring before a separately authorized live delivery check.

Missing/invalid configuration returns a clear safe configuration error. Delivery failures roll back challenge issuance/registration. Delivery and database commits are not a distributed transaction: a rare database failure after provider acceptance can leave an unusable email; the user can retry registration/resend. No provider credentials or codes are printed. Tests replace the sender and never send email.

Email changes through the old user PATCH endpoint are intentionally rejected: changing an email without proving ownership would bypass verification. PATCH now accepts only `ui_language`. A future email-change feature must verify the replacement inbox separately.

Google state, nonce, PKCE, server-side code exchange, signed ID-token verification, issuer/audience/expiration validation, strict boolean `email_verified`, stable `sub`, and explicit authenticated matching-email linking remain intact. Matching emails alone never merge accounts. Google does not trigger the email-code flow.

## Free generation and atomic limits

Generation ignores the legacy credit balance and cost setting. A zero-credit account can generate; successful requests never deduct or refill credits. The post-AI transaction saves one Generation or rolls back completely; AI failures save no Generation. Existing history remains owner-scoped. English and Khmer remain the only output languages.

Defaults: `GENERATION_RATE_LIMIT_PER_MINUTE=5`, `GENERATION_RATE_LIMIT_PER_DAY=50`. Both are rolling windows of request attempts. Under PostgreSQL READ COMMITTED, the limiter acquires the user's row lock, obtains database wall-clock time, prunes that account's attempts older than 24 hours, counts the windows, and inserts/commits the reservation **before** AI. A blocked request returns 429 without calling AI. Provider failures consume a reservation, preventing free repeated failure/retry abuse. Concurrent processes share the same PostgreSQL lock and records; no browser or process-local counter controls admission. A concurrency test proves two admissions from six simultaneous requests with a limit of two.

A periodic maintenance job may delete attempt rows older than 24 hours for dormant accounts; active accounts already prune their rows. Do not remove rows inside the live rolling window. No counter is exposed in the active UX.

## Images and AI

`POST /api/generate` accepts the existing JSON form for text-only clients and multipart fields `product_name`, optional `category`, `features` (free-form multiline text), `tone`, `language`, optional `image`. The JSON features array remains backward-compatible (up to 20 entries, 300 characters each); free-form details allow 6,000 characters and retain newlines. Product names are limited to 200, categories to 100, tones to 50 characters. Unknown identity fields and duplicate multipart fields are rejected.

Both BFF and backend bound actual incoming bytes, including requests without Content-Length: 6 MiB for generation, 64 KiB for other mutation bodies. Pillow validates actual JPEG/PNG/WebP content, matching MIME and extension, verifies integrity and fully decodes. SVG, HTML, executables, format mismatches, malformed images, animated images, and oversized images are rejected. Uploads are capped at 5 MiB; decoded RGBA pixels are capped at approximately 5 MiB (1,310,720 pixels), so a large-dimension compressed photo may need resizing. Re-encoding strips metadata. Image work runs off the async event loop.

Images are not stored in PostgreSQL or permanent files. The bounded multipart parser may use temporary spooled storage, closed after reading; validation/re-encoding uses bounded in-memory images. Only normalized text metadata and the generated description enter history. The browser uses a revocable object URL for preview and sends the file only on Generate.

The official OpenAI SDK and Responses API remain. One call contains text plus optional `input_image` data URL, with `store=False`; the configured model is unchanged. Image API rejection produces `image_model_unavailable` rather than silently ignoring the image or making a second paid call. Tests mock the SDK/service boundary. Reference: [official Python SDK image-input example](https://developers.openai.com/api/reference/python).

The trusted prompt restricts image use to supported color, shape, design, components and legible packaging text, gives supplied facts precedence over uncertain inference, and forbids invented materials, dimensions, warranty, certification, performance, waterproof ratings, ingredients, medical claims, origin, identity or specifications. Image text is untrusted data. These instructions reduce unsupported claims; they cannot guarantee model accuracy. Application-side non-storage does not assert a separate provider retention policy.

## UI, localization and accessibility

Generate has an optional previewable/removable image, product name, searchable custom category combobox, multiline details, tone, separate English/Khmer output selector and generation result. Radix Popover and cmdk provide the shadcn-style keyboard search/custom selection pattern. The predefined category list includes the requested retail categories, Services and Other. A custom query offers `Use "…"` and sends a normal category string.

History preserves search, language filter and pagination. Every card/detail has a top-right Lucide Copy button with `aria-label` and tooltip `Copy description`. It copies only the complete generated description, temporarily shows Check, and displays exactly `Description copied to clipboard.` on success. Clipboard failures are handled safely.

Profile shows email, verification status, Google connection, member date, application language and theme. It does not render credits, plans, merchant data, Google subjects or secrets. Navigation is Generate, History, Profile, theme and language controls, and Logout; language is also available from Profile.

A shared English-key/Khmer dictionary and provider keep URLs unprefixed. Authenticated UI language saves to PostgreSQL and follows the account across devices; non-sensitive local preference supports public pages. UI locale does not affect the output-language field. Khmer uses the existing system/font stack, increased line height and normal letter spacing; no font binaries were added.

`next-themes` controls Light/Dark/System through the shadcn CSS variables. It persists only the non-sensitive theme preference, honors system appearance, and gates theme controls until hydration. Existing reduced-motion rules remain. The existing Magic UI border effect is used only on the landing preview.

Landing and SEO describe image-aware English/Khmer generation, saved history, verified sign-in and free usage. No pricing/payment marketing remains. Protected content remains excluded from indexing.

## Phase 2

- Review and remove dormant payment tables, services, schemas, PayWay adapter, callback code, BFF endpoints and legacy components only through a separately approved data-retention plan.
- Remove legacy `credits`, `plan`, credit adjustment helpers, unused cost configuration and legacy API response fields after consumers are migrated.
- Retire legacy payment tests/archived browser specifications and the payment feature flag once rollback is no longer needed.
- Consider email-change verification, provider delivery webhooks/outbox, and scheduled expired-attempt cleanup as separate features.
- Address the existing high-severity ESLint tooling advisory chain without npm's proposed major downgrade of the Next.js tooling.

## Verification and local review

Final results, session attribution, security findings and the exact created/modified file inventory are recorded in [PHASE1_VERIFICATION_REPORT.md](PHASE1_VERIFICATION_REPORT.md).

Safe frontend review with fixtures (no real backend/provider):

```bash
cd frontend
npm run lint
npx tsc --noEmit
npm test
npm run test:e2e
npm run build
```

For interactive review, use two terminals:

```bash
cd frontend
node tests/mock-backend.mjs
```

```bash
cd frontend
BACKEND_URL=http://127.0.0.1:4311 GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= GOOGLE_REDIRECT_URI= npm run dev -- --hostname 127.0.0.1 --port 3100
```

Open `http://127.0.0.1:3100`. The fixture accepts any test login and verification values; it never contacts an external provider. Do not use real credentials in the fixture UI. The Google button is preserved but intentionally unavailable in this local fixture configuration.

Backend review uses the isolated PostgreSQL instance created for this task, not `.env`'s database:

```bash
cd backend
scripts/phase1-test-env.sh .venv/bin/python -m compileall -q app tests alembic
scripts/phase1-test-env.sh .venv/bin/python -m pip check
scripts/phase1-test-env.sh .venv/bin/python -m unittest discover -s tests -v
scripts/phase1-test-env.sh .venv/bin/alembic current
scripts/phase1-test-env.sh .venv/bin/alembic heads
scripts/phase1-test-env.sh .venv/bin/alembic check
cd ..
git diff --check
```

The helper explicitly targets localhost:55439 database `phase1_utf8` and dummy auth secrets, with provider configuration disabled. If that temporary database is not running, see the verification report for its start command. Do not point migration tests at production. Apply the migration to the real development/staging database only after reviewing and backing up that database; no such application is performed here.
