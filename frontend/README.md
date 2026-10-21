# Generate Description AI frontend

Next.js App Router with a same-origin BFF, English/Khmer UI, and Light/Dark themes through next-themes and shadcn CSS variables.

Active pages: `/`, `/register`, `/verify-email`, `/login`, `/generate`, `/history`, `/history/[id]`, `/profile`. Authenticated navigation is Generate, History, Profile, language, theme and Logout. Legacy bookmarks redirect to Generate or Profile.

Password registration sends an ownership code and opens Verify Email without creating a session. Verification redirects to Login with success feedback. Google uses server-side authorization-code exchange with PKCE, state and nonce. The application JWT stays in an HttpOnly cookie and is never put in client state or localStorage. Local storage holds presentation preferences only.

Generate posts JSON containing `product_name`, optional `category`, multiline `features`, `tone`, and `language` (`English` or `Khmer`). Categories are searchable and allow custom values. UI language is independent of output language. History Copy copies only the description with the exact toast `Description copied to clipboard.` Profile contains account status and presentation preferences.

## Provider-free local review

Run in separate terminals, using only fixture values:

```bash
cd frontend
node tests/mock-backend.mjs
```

```bash
cd frontend
BACKEND_URL=http://127.0.0.1:4311 GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= GOOGLE_REDIRECT_URI= npm run dev -- --hostname 127.0.0.1 --port 3100
```

Open `http://127.0.0.1:3100`. Use an invented email and password; fixtures are not real authentication. Google is intentionally unavailable. Stop both terminals before browser tests, which start their own servers.

```bash
npm run lint
npx next typegen
npx tsc --noEmit
npm test
npm run test:e2e
npm run build
```

Browser tests use loopback fixtures and axe accessibility scans at 320, 375, 390, 768, 1024 and 1440 pixels. See [Phase 2](../PHASE2_PRODUCT_SIMPLIFICATION.md) for database safety and backend checks.

For a real backend, use `frontend/.env.example` as the configuration reference. All OAuth secrets stay server-side. Production cookies require HTTPS. No external fonts or provider calls are required for a build.
