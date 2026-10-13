# Google authentication

Google sign-in uses a server-side authorization-code flow with PKCE S256, state,
and nonce. The Next.js server exchanges the code; FastAPI verifies the ID token
using `google-auth`. Only the existing application JWT is stored in the existing
HttpOnly session cookie. Google access/refresh tokens are neither used nor stored.

An email match never links accounts. Sign in with the existing password and use
**Account → Link Google account**. The Google email must match the current local
email, and the Google subject must be unclaimed or already linked to that user.
Legacy passwordless accounts also require explicit linking; this task adds no
recovery, password-setting, account merging, or unlink operation.

## Configure locally

Create a **Web application** OAuth client in Google Cloud, configure the consent
screen/test users, and register this exact authorized redirect URI:

`http://localhost:3000/api/auth/google/callback`

Set `GOOGLE_CLIENT_ID` in the existing `backend/.env`. Set `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `frontend/.env.local`, using
the same client ID on both servers. The secret belongs only in the frontend's
server environment. Keep the existing database, JWT, and other settings intact.
Neither environment file should be committed. Missing configuration produces a
safe unavailable message.

Run from the repository root (existing backend virtual environment):

```bash
cd backend
source .venv/bin/activate
python -m pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

In a second terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Use `http://localhost:3000` consistently so the OAuth cookies and registered
redirect host match. For production use an HTTPS redirect URI, register that
exact URI with Google, and configure both environments accordingly. Production
OAuth cookies use the `__Host-` prefix, Secure, HttpOnly, SameSite=Lax, Path=/,
and a 600-second lifetime. The link flow is bound to the original app session.
Every callback result clears all temporary OAuth cookies. Starting another flow
in the same browser replaces the pending flow; restart if the older tab fails.

The callback sets `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
Next.js development request logging excludes Google OAuth routes. Configure any
production reverse proxy/APM/access logger to omit callback query strings and
authentication request/response bodies, which can contain credentials.

## Verification

No automated test calls Google or OpenAI live. The Google backend tests mock
the official verifier; frontend tests mock provider exchange and backend calls.
Backend tests use migrated local PostgreSQL and create isolated test accounts,
which are deactivated afterward, consistent with the existing suite.

Start the HTTP test server in a separate terminal:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8766 --no-access-log
```

Then run from the repository root:

```bash
cd backend
source .venv/bin/activate
python -m compileall -q app tests alembic
python -m pip check
TEST_API_URL=http://127.0.0.1:8766 python -m unittest discover -s tests -v
alembic current
alembic heads
alembic check
cd ../frontend
node tests/google-oauth.test.mjs
npm run lint
npx tsc --noEmit
npm run build
```

Manual Google sign-in remains to be tested after credentials are configured.
Check a new account, repeat login after spending credits, existing-password
email conflict, explicit linking, cancellation, and session expiry. Do not
paste tokens, authorization codes, credentials, or OAuth callback URLs into logs.

References: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
and [official ID-token verification utility](https://googleapis.dev/python/google-auth/latest/reference/google.oauth2.id_token.html).
