# Generate Description AI frontend

Next.js 16.4 App Router frontend for the existing FastAPI backend. No additional runtime dependencies.

## Local development

From `frontend/`:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Keep the existing backend running at `http://127.0.0.1:8000`. Open `http://localhost:3000`. `.env.local` is ignored; `.env.example` contains no secrets. Set `BACKEND_URL` to the backend's server-accessible URL. `NEXT_PUBLIC_APP_NAME` is public. PayWay configuration belongs to the backend; no checkout origin is needed in the frontend.

```bash
npm run lint
npx tsc --noEmit
npm run build
node --test tests/*.test.mjs
npm start
```

Production must use HTTPS because the access cookie is Secure in production. Use `npm run dev` for local HTTP login testing. The backend must already have its database, migrations, authentication, AI, and optional PayWay configuration in place.

## Authentication and API boundary

Browser requests use Next.js `/api/*`. The server-only backend client attaches the FastAPI bearer token from the HttpOnly `access_token` cookie. Login returns `{ok:true}`, never the JWT. Cookie lifetime comes from backend `expires_in`; cookies are host-only, path `/`, SameSite=Lax, and Secure in production. No localStorage or refresh tokens are used.

Successful email/password and Google sign-in open `/generate`. Legacy `/dashboard` bookmarks redirect there. Registration still opens Login because it does not create a session. Account contains the real credit balance, current plan, profile, and Google connection controls.

Protected layouts validate the session server-side. Every protected BFF request independently requires the cookie and relies on backend authorization. Backend 401 responses clear stale cookies; client API calls navigate to login. Server-rendered guards redirect expired sessions to login (Server Components cannot mutate cookies). Backend outages display a safe retry page instead of pretending the user is logged out.

POST handlers require an exact same-origin Origin header, reject cross-site fetches, and require JSON where applicable. Deploy the reverse proxy so the Next.js request origin matches the public site origin. API responses use no-store. Errors use `{error:{message}}`, with safe status-specific messages; raw upstream errors and validation inputs never reach users. User auth responses explicitly select public fields.

## Payments

Catalog prices and credits come from FastAPI. Purchase requests contain only `package_code`. The backend calls Purchase and returns only sanitized QR checkout data through the BFF. Pricing opens a responsive checkout dialog with the PNG and an explicit Open ABA Mobile link. The browser never calls PayWay directly or receives signed Purchase fields. QR creation leaves the payment pending and grants no credits.

The QR exists only in component memory: closing the dialog, leaving, or reloading loses it. Closing does not cancel the backend payment. Payments offers manual verification and explains that an unpaid user may create a new payment if the QR was lost; it never reissues an old Purchase. Verify payment keeps pending QR checkout visible, shows safe provider errors, and refreshes credits through `/api/auth/me` only after paid confirmation. No polling is added.

The BFF stores a last-checkout payment ID in a separate HttpOnly cookie (24 hours). `/payments/return` ignores query parameters and verifies that ID through the authenticated owner-only endpoint. Only a backend `paid` status produces a success message. Multiple checkouts may overwrite the last ID; `/payments` provides recovery for all pending transactions. Login/logout clears the last-checkout cookie. Missing cookies or interrupted checkout never imply success.

Configure the backend's browser continuation URL for `/payments/return` where supported. Do not confuse that browser URL with the backend's server callback URL. The existing unresolved live callback-secret issue is unchanged; frontend code does not verify callbacks or grant credits.

## Manual acceptance check

Use a disposable account and a backend configured with an AI test double if avoiding paid OpenAI requests:

1. Register; confirm the success notice on Login. Log in and confirm the backend's initial credits (normally 10).
2. Generate in English; confirm the result, usage, refreshed balance (normally 9), and history detail/copy.
3. Generate in Khmer; confirm Unicode display, refreshed balance (normally 8), and both history entries.
4. Check pagination and missing history IDs. Log out and open every protected URL directly.
5. Load pricing and payment history. With sandbox configuration only, create a checkout and confirm a pending QR with unchanged credits. Follow the reviewed end-to-end steps in `../backend/PAYMENTS.md` for the single manual sandbox transaction.
6. Verify a pending transaction and return with/without a last-checkout cookie. Browser query parameters must never establish payment success. Check another account cannot verify the transaction.
7. Test expired JWT, unavailable backend, insufficient credits, validation errors, unavailable AI, and unavailable PayWay. Credits must be refreshed from `/api/auth/me` after successful generation/verification.

Payment component/BFF tests reuse the existing lightweight Node test runner and TypeScript transpilation approach used by the OAuth tests; no framework was added. Do not run real AI generations or live payments as automated smoke tests.

## Frontend redesign and review

The UI uses the official shadcn `new-york` registry, Radix primitives, Tailwind 4,
Lucide, and Sonner. The installed Magic UI Border Beam is limited to the landing
preview. The Animate UI Radix Sheet powers mobile navigation. Both respect reduced
motion. Light/dark colors follow the operating system. Native selects preserve
keyboard and mobile form behavior. English and Khmer use system fonts with Noto Sans
Khmer / Khmer OS fallbacks; no external font request is required.

Set `SITE_URL=https://your-public-domain` in the deployment environment **before
building** to enable absolute canonical URLs and the public sitemap. This is a
server-only, non-secret setting. Unset, invalid, non-HTTPS, and localhost values
omit canonical URLs and sitemap entries. Pricing is authenticated; only `/` belongs
in the sitemap. Login, register, and private pages use `noindex, nofollow`.

Run checks from `frontend`:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run test:e2e
```

`test:e2e` starts its own loopback-only fixture backend on port 4311 and frontend on
3100. Fixtures live exclusively under `tests/`. Browser requests to external hosts
are blocked. Tests exercise the real BFF with a fake session; they never call
OpenAI, Google OAuth, or PayWay. Chromium can be installed using
`npx playwright install chromium`. Responsive screenshots are written under
`test-results/` (ignored by git). The test QR is a non-scannable layout fixture,
not a payment code.

For a manual review with **no live services**, run these in separate terminals:

```bash
# Terminal 1, from the repository root
cd frontend
node tests/mock-backend.mjs
```

```bash
# Terminal 2, from the repository root
cd frontend
BACKEND_URL=http://127.0.0.1:4311 SITE_URL=https://description.example GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= GOOGLE_REDIRECT_URI= npm run dev -- --hostname 127.0.0.1 --port 3100
```

Visit http://127.0.0.1:3100. Any syntactically valid email and nonempty password
work against this **test-only** backend (for example `designer@example.test` and
`local-test-password`). Use 375px, 768px, and 1440px viewports; also check 320px.
Stop both processes with Ctrl+C. For the real development backend instead, use
`npm run dev` with your existing `.env.local`; generation/payment actions then
use that backend and may invoke real services.

Component installation references:
- https://ui.shadcn.com/docs/installation/manual
- https://magicui.design/docs/components/border-beam
- https://animate-ui.com/docs/components/radix/sheet

Local adaptations: 44px primary controls, reduced-motion handling, a 200ms drawer
transition, and controlled drawer state without effect-driven state mirroring.
