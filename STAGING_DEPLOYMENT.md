# Staging deployment runbook

This prepares an isolated staging environment. No deployment, cloud creation, commit,
or push was performed during preparation. All values below are placeholders or safe
configuration defaults. Enter credentials only in provider environment settings;
never paste them into this document, source code, terminal output, or build logs.

## A. Prepare the staging branch

1. Review the working-tree changes and verification results below.
2. When ready to publish manually, create the branch from the reviewed base:
   `git switch -c staging` (or `git switch staging` if it already exists).
3. Review `git diff --check` and `git status --short`. Stage only reviewed source,
   examples, tests, and deployment files. Commit and push the branch yourself when
   authorized. Neither action is part of this preparation task.
4. Use separate staging projects, database, JWT secret, and provider credentials.
   Select one stable HTTPS frontend hostname for all tests; avoid per-commit URLs
   for OAuth. Do not connect either staging project to a production database.

## B. Create Render PostgreSQL

1. In Render, create a PostgreSQL database named `generate-description-staging-db`.
2. Select the region also used for the API, and a plan appropriate for staging.
3. Keep external database access disabled when using Render Shell. Copy the
   **Internal Database URL** privately into the API's `DATABASE_URL` setting.
4. The optional root `render.yaml` describes both resources instead of these manual
   creation steps. Review plans and region before applying it: it selects paid
   `0.5c-512mb` web and `0.1c-256mb` database compute, disables automatic deploys,
   and blocks external database connections. Applying it creates resources and
   triggers the initial deployment. Do not create duplicate resources with both
   workflows. Secret inputs use `sync: false`, and the DB URL uses `fromDatabase`.

## C. Create the Render FastAPI service

Create a Web Service from the repository's `staging` branch with:

| Setting | Value |
| --- | --- |
| Runtime | Python |
| Root Directory | `backend` |
| Python version environment variable | `PYTHON_VERSION=3.14.4` (local validated version) |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |
| Automatic deployments | Disabled during initial staging setup |

Configure section D before starting the service. Do not replace `$PORT` with a
localhost binding. Keep the frontend unavailable to testers until migrations finish.
`/health` can succeed before migrations because it deliberately does not query DB.
A clean dependency install on Render remains a deployment gate; the local checks
validate the installed environment, not availability of all packages on Render.

## D. Configure backend environment

Use Render Environment settings. Existing setting names are preserved:

| Variable | Staging value / purpose |
| --- | --- |
| `APP_NAME` | `Generate Description AI API` (default) |
| `APP_ENV` | `staging` |
| `FRONTEND_URL` | `https://<staging-frontend-host>`; exact origin, no path |
| `DATABASE_URL` | Render Internal Database URL; keep private |
| `JWT_SECRET_KEY` | Unique securely generated staging secret, at least 32 bytes |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `OPENAI_API_KEY` | Staging backend-only API credential |
| `OPENAI_MODEL` | An explicitly selected model available to the staging project |
| `OPENAI_MAX_OUTPUT_TOKENS` | `600` |
| `OPENAI_TIMEOUT_SECONDS` | `30` |
| `GENERATION_CREDIT_COST` | `1` |
| `GOOGLE_CLIENT_ID` | Same web OAuth client ID used by frontend |
| `PAYWAY_ENV` | `sandbox` only |
| `PAYWAY_MERCHANT_ID` | Sandbox merchant credential |
| `PAYWAY_API_KEY` | Sandbox signing credential; backend-only |
| `PAYWAY_API_URL` | `https://checkout-sandbox.payway.com.kh` (base URL only) |
| `PAYWAY_RETURN_URL` | Empty / unset |
| `PAYWAY_CONTINUE_SUCCESS_URL` | Empty / unset |
| `PAYWAY_CANCEL_URL` | Empty / unset |
| `PAYWAY_TIMEOUT_SECONDS` | `15` |

Pydantic reads environment settings before the local `.env` defaults. Do not upload
`backend/.env`. SQLAlchemy and Alembic both use `settings.database_url`.
`postgresql://...` is internally converted to `postgresql+psycopg://...`; already
qualified URLs remain unchanged, including credentials, percent escapes and options.
The URL is never logged by this normalization.

CORS uses the existing `FRONTEND_URL`, not an additional origin variable. Local dev
keeps `http://localhost:3000`; staging replaces it with one HTTPS origin. Wildcards,
paths, userinfo and non-local HTTP origins are rejected. Credentials remain disabled
in CORS. The browser uses the same-origin Next.js BFF; the BFF forwards bearer tokens
server-to-server, so cross-origin browser cookies are unnecessary.

PayWay manual QR verification uses Purchase and Check Transaction. The three optional
return/continue/cancel URLs are omitted from purchase fields when empty. Do not append
an API endpoint to `PAYWAY_API_URL`. Callback key provisioning is still unconfirmed;
`get_callback_verification_key()` remains fail-closed. Do not invent a callback secret,
reuse the API signing key for callbacks, or enable callback verification.

## E. Run migrations before opening staging

After the first API deploy, open its Render Dashboard **Shell**. In the deployed
`backend` working directory (the directory containing `alembic.ini`), run:

```sh
alembic heads
alembic upgrade head
alembic current
alembic check
```

Expected single head/current revision: `7b81e2ac940d`. Expected check result:
`No new upgrade operations detected.` No new migration is needed for this change.
Do not print environment variables to diagnose connection problems.

A pre-deploy command of `alembic upgrade head` is optional when supported by your
service plan. The deployment does not depend on that feature, and migration commands
are deliberately excluded from both build and start commands. Run one migration
process at a time. For later releases, take a staging database backup first and
coordinate schema changes with the deployed code.

If your plan does not offer Shell, use a trusted local checkout at the same revision,
install `backend/requirements.txt` into a virtual environment, and run the commands
above from `backend/` with the staging External Database URL supplied through a secure
environment mechanism. Temporarily allow only your IP in Render's database access
settings and use TLS (`sslmode=require`); remove that access afterward. Do not paste
credentials into command history or modify the existing local `.env`. Supply a valid
staging `JWT_SECRET_KEY` too because shared settings validate it on startup. Alternatively,
select a service plan with Shell. Never run these commands against production.

## F. Verify the backend

```sh
curl --fail --silent --show-error https://<render-backend-host>/health
curl --fail --silent --show-error https://<render-backend-host>/health/database
```

Expect `{"status":"ok"}` and `{"status":"ok","database":"connected"}` respectively.
`/health` is a lightweight liveness check with no paid external or database calls.
`/health/database` performs only `SELECT 1`; it does not prove the schema is migrated,
so also verify Alembic current/check. Provider readiness is covered by smoke tests.

## G. Import frontend into Vercel

1. Create a dedicated staging Vercel project from the same repository.
2. Choose Next.js, Root Directory `frontend`, Build Command `npm run build`.
   Keep normal framework install/output defaults; no `vercel.json` is required.
3. Point this project's deployment branch to `staging`. For a dedicated staging
   project, Vercel may label its stable deployment scope "Production"; this is a
   platform label only. Use staging credentials there, never production credentials.
   Alternatively use a branch-scoped Preview/custom environment and a stable hostname;
   set every variable in that selected scope. Do not assume Preview variables apply
   to a project deployment in the Production scope.
4. Choose the stable hostname before configuring OAuth. If Vercel first assigns it
   on deployment, update all origins and redirect settings and redeploy afterward.

## H. Configure frontend environment

| Variable | Value |
| --- | --- |
| `BACKEND_URL` | `https://<render-backend-host>` (no `/api` suffix) |
| `GOOGLE_CLIENT_ID` | Staging OAuth web client ID, identical to backend |
| `GOOGLE_CLIENT_SECRET` | Staging OAuth client secret, server-only |
| `GOOGLE_REDIRECT_URI` | `https://<staging-frontend-host>/api/auth/google/callback` |
| `SITE_URL` | `https://<staging-frontend-host>` |
| `NEXT_PUBLIC_APP_NAME` | `Generate Description AI` (optional existing display setting) |

The project's existing public site URL mechanism is **`SITE_URL`**, not
`NEXT_PUBLIC_SITE_URL`. Use `SITE_URL` for the staging URL concept: introducing the
unused `NEXT_PUBLIC_SITE_URL` would not configure metadata. HTTPS public metadata
uses the configured origin without request/user data. Sitemap includes only `/`;
private pages remain excluded. Do not put secrets under `NEXT_PUBLIC_`.
`BACKEND_URL`, Google configuration, and the JWT cookie are handled server-side.
Do not put database, OpenAI, PayWay, or JWT signing credentials in Vercel.

## I. Deploy Vercel manually

Deploy the reviewed staging branch after backend health and migrations pass.
Open the stable hostname and check the landing page and metadata. If using deployment
protection, give testers access and ensure it allows their OAuth browser round trip.
Use the stable hostname throughout login; switching between aliases breaks the
host-scoped OAuth state cookies.

## J. Configure Google OAuth

In Google Cloud, configure a Web application OAuth client dedicated to staging:

- Authorized JavaScript origin: `https://<staging-frontend-host>`
- Authorized redirect URI: `https://<staging-frontend-host>/api/auth/google/callback`
- If the consent screen is in Testing, add staging testers as test users.

The URI must match `GOOGLE_REDIRECT_URI` exactly. Keep state, nonce, S256 PKCE,
HttpOnly session cookies, and the existing explicit linking policy. Existing password
accounts are not silently linked merely because Google returns the same email:
log in normally and link from Account. No live Google call is part of preparation.

## K. Redeploy after final OAuth configuration

Save the final Vercel environment variables, then redeploy the frontend so build-time
metadata and runtime settings both use the stable origin. Set Render `FRONTEND_URL`
to that same origin, confirm its `GOOGLE_CLIENT_ID`, and redeploy the backend after
any backend environment changes. Retry login from a fresh session.

## L. Staging smoke tests

Use staging-only users. Real generation smoke tests consume OpenAI usage and app
credits; automated preparation tests mock providers. Complete this flow:

- [ ] Landing: correct staging canonical/Open Graph URL, no private sitemap pages.
- [ ] Login/Register: create a staging account, validate errors and session persistence.
- [ ] Google Login: correct callback; test explicit linking for an existing email.
- [ ] Generate English: response saved; expected credit deduction.
- [ ] Generate Khmer: Khmer response saved; expected credit deduction.
- [ ] History: only this user's generations appear.
- [ ] Account: correct user, balance, and linked account state.
- [ ] Pricing: plans and Starter purchase available.
- [ ] Buy Starter: creates a pending sandbox payment.
- [ ] PayWay sandbox QR appears.
- [ ] Verify before payment: remains pending; no paid credits awarded.
- [ ] Payments: pending record visible only to its owner.
- [ ] Logout: protected pages redirect to login.
- [ ] Login again: history, account and payment state remain correct.

An APPROVED ABA payment is **not required**: ABA Simulator access is pending.
Do not fake an approval, enable callbacks, or use production PayWay credentials.
Check the browser stores the backend-issued JWT only in a Secure, HttpOnly cookie
on Vercel; there must be no token in localStorage or page metadata.

## M. Rollback basics

Record the tested backend/frontend commit and Alembic revision before each release.
Stop further staging deployments if a smoke test fails. Redeploy the last known-good
Render commit and Vercel deployment, keeping the stable hostname and matching env
settings. Application rollback does not roll back PostgreSQL. Prefer a compatible
forward fix; restore a staging backup into a separate database if necessary after
reviewing data loss. Do not blindly run `alembic downgrade` or delete payment records.
Re-run health, Alembic checks, login and pending-payment tests after recovery.

## Verification and security

From `backend/` with its virtual environment activated:

```sh
python -m compileall -q app tests alembic
python -m pip check
python -m unittest discover -s tests -v
alembic heads
alembic check
```

The existing integration suite requires local migrated PostgreSQL and a local API
at `http://127.0.0.1:8765` (start `uvicorn app.main:app --host 127.0.0.1 --port 8765`).
It creates test records. Do not point it at production or run the full suite as a
staging smoke test. External provider boundaries are mocked.

From `frontend/`:

```sh
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run test:e2e
```

Browser tests use the existing mock backend. From repository root: `git diff --check`.
`backend/.env` and `frontend/.env.local` must remain ignored and untracked. No real
secret belongs in the Blueprint or examples. Backend-issued JWTs remain in HttpOnly
BFF cookies; Google secret remains server-only; OpenAI and PayWay keys remain
backend-only. No localStorage authentication or wildcard credentialed CORS is added.

Provider references: [Render Blueprint specification](https://render.com/docs/blueprint-spec),
[Render Python version](https://render.com/docs/python-version),
[Vercel monorepos](https://vercel.com/docs/monorepos),
[Vercel environment variables](https://vercel.com/docs/environment-variables).

### Preparation results (2026-10-15)

- Backend compileall and pip check passed; 88 unittest tests passed.
- Alembic head: `7b81e2ac940d`; local migrated database check passed with no new
  upgrade operations. No schema migration was added or applied during preparation.
- `/health` returned HTTP 200 with `{"status":"ok"}` in the deployment contract test.
- Frontend lint, TypeScript, all three unit-test files, and all 31 Playwright tests passed.
- Normal `npm run build` passed in a clean temporary copy with installed dependencies,
  without local env files. Original-workspace attempts encountered a sandbox/Turbopack
  port error and an existing dev-server lock; isolated verification avoided those.
- Blueprint YAML and key configuration invariants passed local validation. It has not
  been submitted to Render or used to create resources.
- `git diff --check` passed. Both real env files are ignored/untracked. A scan of the
  current tracked tree found no common OpenAI/Google/private-key credential signatures;
  this is not a forensic audit of Git history. No real secrets were modified or printed.
- Backend tests emitted two unclosed Psycopg connection ResourceWarnings after passing.
- No cloud readiness check or fresh Render dependency installation was performed.
  Actual hostnames, cloud credentials, OAuth settings and live smoke tests remain manual.
  ABA Simulator approval remains pending and does not block pending-QR staging tests.
