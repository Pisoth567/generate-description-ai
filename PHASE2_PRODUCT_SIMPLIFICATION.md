# Phase 2 product simplification

The product is a free, text-only AI Product Description Generator. This change preserves Phase 1 email ownership verification, Google authentication, history ownership, custom categories, English/Khmer application language, and Light/Dark/System themes. Phase 1 documents remain historical records; this document is the current configuration reference.

## Architecture and active routes

Next.js serves the UI and same-origin BFF. An HttpOnly application JWT cookie is read only on the server and attached to FastAPI requests there. Mutations retain origin checks. PostgreSQL stores users, generations, email verification challenges and generation attempts. Protected pages remain noindex; the sitemap includes only the landing page. No auth token is stored in browser localStorage or rendered in the DOM.

Public pages: `/`, `/register`, `/verify-email`, `/login`. Authenticated pages: `/generate`, `/history`, `/history/[id]`, `/profile`. Navigation contains Generate, History, Profile, language, theme and Logout. `/pricing`, `/payments`, `/payments/return`, `/dashboard` redirect to `/generate`; `/account` redirects to `/profile`. Backend payment routes and callbacks and frontend payment BFF handlers are absent, returning 404.

## Generation API and free usage

`POST /api/generate` accepts authenticated JSON only:

```json
{
  "product_name": "Canvas tote",
  "category": "Handmade Khmer Products",
  "features": "Cotton canvas\nInside pocket",
  "tone": "friendly",
  "language": "Khmer"
}
```

Product names allow 200 characters; optional categories allow 100; tones allow 50. Multiline features allow 6,000 characters. The existing JSON features-array format remains compatible (20 entries, 300 characters each). Unknown fields are rejected. English and Khmer are the only output languages; defaults remain professional tone and English. Actual request bytes are bounded to 64 KiB in the BFF and backend, including chunked requests.

The response contains `generation_id`, `description`, `tone`, `language`, and `tokens_used`. No credit balance, deduction, purchase action or 402 path exists. A legacy zero-balance account works even before cleanup; an isolated migration test verifies this. Failed AI calls save no generation. History list/detail queries remain owner-scoped.

The official OpenAI SDK Responses API receives text JSON only with `store=False`. Trusted instructions retain natural English/modern Khmer, requested tone, useful e-commerce detail and no unsupported facts/specifications. Multipart uploads, validation/decoding, image prompts and multimodal construction are removed. Pillow and python-multipart are removed from requirements because there are no remaining consumers. Existing virtualenv packages are not forcibly uninstalled. httpx remains required by OpenAI and the test client. Next.js Image remains only for the existing static brand asset, unrelated to generation.

## Anti-abuse policy

`GENERATION_RATE_LIMIT_PER_MINUTE=5`. There is no daily cap or daily-limit setting. Before provider I/O, a PostgreSQL transaction locks the authenticated user's row, obtains database wall-clock time, prunes attempts outside the rolling minute, counts attempts and reserves/commits an admission. Locks and records are shared across processes. A sixth request within the minute returns 429 without calling AI. Failed provider calls consume their reservation. Different users are independent. The UI shows a safe localized wait-and-retry message, not a balance. Dormant rows may be removed by maintenance only when older than the live minute.

## Registration, OTP and Google

Password registration → unverified account and email delivery → Verify Email → consume valid OTP and set `email_verified_at` → Login success notice → password login → Generate. Registration and verification never grant a normal session. Delivery failure returns sanitized 503 and rolls back registration/challenge changes; a new registration can retry, and an existing unverified account can resend later. Wrong/expired/consumed/locked-out codes share a safe error. Unknown/verified/inactive/cooldown resend requests retain the Phase 1 non-enumerating response; no new delivery is attempted for them.

Codes are six numeric digits generated cryptographically, stored only as a user-scoped HMAC-SHA256 digest using an independent backend-only secret, expire after ten minutes, allow five failed attempts and have a 60-second resend cooldown. Reissue replaces the old digest and successful verification consumes it. User row locks serialize verification/resend. OTP is email ownership proof, not login 2FA. Existing password-only accounts are not automatically verified; inactive users remain rejected. Password hashing remains Argon2id.

Verify Email retains a masked address, editable address for recovery, numeric/paste-friendly accessible six-digit field, resend countdown, sanitized errors and redirect to Login with success feedback. Register retains password confirmation and Continue with Google. An unverified login offers Verify Email.

Google authorization-code flow, PKCE, state, nonce, server-side exchange, signature/issuer/audience/expiration checks, strict `email_verified == true`, stable Google subject identity, HttpOnly session and explicit matching-email account linking remain intact. Verified Google sign-in needs no OTP. No matching-email auto-merge was introduced.

## SMTP delivery configuration

Configure only in the backend environment/secret store:

```dotenv
EMAIL_PROVIDER=smtp
EMAIL_FROM=
EMAIL_VERIFICATION_SECRET=
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_USE_TLS=true
```

Use a sender authorized by your provider and provider-issued SMTP credentials (or an approved app-specific credential); never a normal personal Gmail password. The verification secret must be independent of JWT signing and at least 32 bytes. Do not commit, print or put credentials in frontend variables.

`SMTP_USE_TLS=true` requires STARTTLS before authentication, normally on port 587. `false` selects implicit TLS, normally on port 465; it never permits plaintext SMTP. Both use the standard certificate/hostname-verifying SSL context, with a ten-second connection/socket timeout and no insecure fallback. Missing settings/disabled provider fail with `email_configuration_required`; TLS, authentication, refused-recipient and transport failures return `email_delivery_unavailable`. No provider exception is returned or logged.

The stdlib SMTP adapter avoids another dependency. Auth endpoints are synchronous FastAPI handlers, which run in its worker threadpool; SMTP does not block the async event loop. Tests replace the mail boundary or SMTP transports and never connect live. The multipart email has plain-text and HTML alternatives, application name, code, ten-minute expiry and an ignore-if-not-registered security note. Neither OTPs nor credentials are logged. Like Phase 1, email acceptance and database commit are not an atomic distributed transaction; retry handles a rare post-send commit failure.

## UI, localization and themes

Generate contains only product name, searchable/custom category, multiline product details/features, tone, output language and Generate Description. Application language and generated output language remain independent. Landing, auth, verification, Generate, History, Profile, navigation, errors and theme controls use the English/Khmer dictionary. The static Khmer example and brand remain intentional. Native-speaker review remains useful editorial QA.

History preserves search, language filter, pagination and top-right Copy buttons. Copy copies only the generated description; the exact success toast remains `Description copied to clipboard.` in both UI languages. Profile shows email, verification, Google connection, member date, UI language and theme, without internal subjects/tokens or retired billing data. next-themes remains the theme engine; shadcn CSS variables define colors. Magic UI's existing landing border is decorative only.

## Removed functionality and migration warning

Payment routes, schemas, model, services, PayWay signing/catalog/callback handling, configuration/feature flags, frontend BFF handlers, checkout/components/types/tests and obsolete billing documentation are removed. Legacy redirect pages remain. Credits/plans are removed from user models, auth/user responses, business logic, BFF sanitization and client types. Historical Alembic revisions remain unchanged so migration history remains valid.

**Revision `f20b2c3d4e50`, parent `e10a1b2c3d40`, drops `payments`, `users.credits`, and `users.plan`. This permanently deletes payment rows and legacy balance/plan values. Back up/export and review before applying. Downgrade recreates columns with legacy defaults and the payment schema, indexes and constraints; it cannot recover deleted values or payment rows. No users or generations are deleted.**

The migration was intentionally NOT applied to the developer's configured real local database. It was tested only in a fresh disposable PostgreSQL database and disposable schemas. Tests verify preserved users/passwords/history, zero-balance generation before cleanup, schema parity, downgrade reconstruction and re-upgrade.

## Manual backup and migration — only after review

Stop application writes. Configure a local PostgreSQL service named `generate_description` in your private libpq service file, with credentials kept in a protected password file or prompted locally. The service must identify the intended database. Do not paste its credentials into commands or chat. These commands are suggestions, not operations performed in this task:

```bash
umask 077
pg_dump --dbname='service=generate_description' --format=custom --file=phase2-before-cleanup.dump
pg_restore --list phase2-before-cleanup.dump > phase2-before-cleanup.contents
```

Verify the archive and test restoration into a separate disposable database before relying on it. Retain the export according to your retention policy. After reviewing the cleanup revision, confirm the backend environment targets the same intended database, then manually run from the repository root:

```bash
cd backend
.venv/bin/alembic current
.venv/bin/alembic heads
.venv/bin/alembic upgrade f20b2c3d4e50
.venv/bin/alembic check
```

If schema rollback is deliberately required, `.venv/bin/alembic downgrade e10a1b2c3d40` restores schema only. Recover historical data from a verified backup, not from downgrade. Never run the backend test suite against an application database.

## Exact isolated test and manual UI commands

The helper explicitly sets the disposable database at localhost:55439 (`phase2_test`), test-only signing values and disabled providers; it does not source deployment credentials. A newly initialized cluster for this task lives at `/tmp/phase2-test-pg`.

If recreating the disposable instance (initialize/create only if absent):

```bash
/usr/lib/postgresql/18/bin/initdb -D /tmp/phase2-test-pg -A trust --encoding=UTF8 --no-locale
/usr/lib/postgresql/18/bin/pg_ctl -D /tmp/phase2-test-pg -l /tmp/phase2-test-pg.log -o '-h 127.0.0.1 -p 55439 -k /tmp' start
/usr/lib/postgresql/18/bin/createdb -h 127.0.0.1 -p 55439 phase2_test
cd backend
scripts/phase1-test-env.sh .venv/bin/alembic upgrade head
scripts/phase1-test-env.sh .venv/bin/python -m compileall -q app tests alembic
scripts/phase1-test-env.sh .venv/bin/python -m pip check
scripts/phase1-test-env.sh .venv/bin/python -m unittest discover -s tests -v
scripts/phase1-test-env.sh .venv/bin/alembic heads
scripts/phase1-test-env.sh .venv/bin/alembic check
```

Frontend checks:

```bash
cd frontend
npm run lint
npx next typegen
npx tsc --noEmit
npm test
npm run test:e2e
npm run build
cd ..
git diff --check
```

For manual review with no live providers, start in two terminals:

```bash
cd frontend
node tests/mock-backend.mjs
```

```bash
cd frontend
BACKEND_URL=http://127.0.0.1:4311 GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= GOOGLE_REDIRECT_URI= npm run dev -- --hostname 127.0.0.1 --port 3100
```

Visit `http://127.0.0.1:3100` using invented fixture credentials. Review registration/verification/login, custom category, both output languages, History Copy, Profile, UI languages and theme at 320/375/390/768/1024/1440 pixels. Fixtures do not prove real delivery or real OAuth. Stop fixture servers before automated browser tests.

## Verification and operational status

Detailed results and the complete created/modified/removed inventory are in [Phase 2 verification report](PHASE2_VERIFICATION_REPORT.md). No commit, push, deployment, live SMTP/email, OpenAI, Google OAuth or PayWay operation was performed. Real SMTP/sender configuration, independent secrets, reviewed database rollout and any separately authorized provider acceptance checks remain operator setup tasks.
