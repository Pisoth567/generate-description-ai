# Generate Description AI frontend

Next.js 16.4 App Router frontend for the existing FastAPI backend. No additional runtime dependencies.

## Local development

From `frontend/`:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Keep the existing backend running at `http://127.0.0.1:8000`. Open `http://localhost:3000`. `.env.local` is ignored; `.env.example` contains no secrets. Set `BACKEND_URL` to the backend's server-accessible URL. `NEXT_PUBLIC_APP_NAME` is public. `PAYWAY_CHECKOUT_ORIGIN` must match the backend provider environment; only the exact HTTPS sandbox and production PayWay origins are accepted.

```bash
npm run lint
npx tsc --noEmit
npm run build
npm start
```

Production must use HTTPS because the access cookie is Secure in production. Use `npm run dev` for local HTTP login testing. The backend must already have its database, migrations, authentication, AI, and optional PayWay configuration in place.

## Authentication and API boundary

Browser requests use Next.js `/api/*`. The server-only backend client attaches the FastAPI bearer token from the HttpOnly `access_token` cookie. Login returns `{ok:true}`, never the JWT. Cookie lifetime comes from backend `expires_in`; cookies are host-only, path `/`, SameSite=Lax, and Secure in production. No localStorage or refresh tokens are used.

Protected layouts validate the session server-side. Every protected BFF request independently requires the cookie and relies on backend authorization. Backend 401 responses clear stale cookies; client API calls navigate to login. Server-rendered guards redirect expired sessions to login (Server Components cannot mutate cookies). Backend outages display a safe retry page instead of pretending the user is logged out.

POST handlers require an exact same-origin Origin header, reject cross-site fetches, and require JSON where applicable. Deploy the reverse proxy so the Next.js request origin matches the public site origin. API responses use no-store. Errors use `{error:{message}}`, with safe status-specific messages; raw upstream errors and validation inputs never reach users. User auth responses explicitly select public fields.

## Payments

Catalog prices and credits come from FastAPI. Purchase requests contain only `package_code`. The BFF validates the configured PayWay origin before returning checkout data. The browser POSTs backend-signed fields to PayWay without logging them. The provider necessarily receives those checkout fields; API credentials remain server-side.

The BFF stores a last-checkout payment ID in a separate HttpOnly cookie (24 hours). `/payments/return` ignores query parameters and verifies that ID through the authenticated owner-only endpoint. Only a backend `paid` status produces a success message. Multiple checkouts may overwrite the last ID; `/payments` provides recovery for all pending transactions. Login/logout clears the last-checkout cookie. Missing cookies or interrupted checkout never imply success.

Configure the backend's browser continuation URL for `/payments/return` where supported. Do not confuse that browser URL with the backend's server callback URL. The existing unresolved live callback-secret issue is unchanged; frontend code does not verify callbacks or grant credits.

## Manual acceptance check

Use a disposable account and a backend configured with an AI test double if avoiding paid OpenAI requests:

1. Register; confirm the success notice on Login. Log in and confirm the backend's initial credits (normally 10).
2. Generate in English; confirm the result, usage, refreshed balance (normally 9), and history detail/copy.
3. Generate in Khmer; confirm Unicode display, refreshed balance (normally 8), and both history entries.
4. Check pagination and missing history IDs. Log out and open every protected URL directly.
5. Load pricing and payment history. With sandbox configuration only, create a checkout and confirm the PayWay destination. Do not submit a live payment.
6. Verify a pending transaction and return with/without a last-checkout cookie. Browser query parameters must never establish payment success. Check another account cannot verify the transaction.
7. Test expired JWT, unavailable backend, insufficient credits, validation errors, unavailable AI, and unavailable PayWay. Credits must be refreshed from `/api/auth/me` after successful generation/verification.

No testing framework was present, so none was added. Do not run real AI generations or live payments as automated smoke tests.
