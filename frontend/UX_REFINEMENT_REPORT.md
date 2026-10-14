# Checkout and Account UX refinement

## Scope and files

This refinement changes frontend presentation and fixed post-login destinations only. No dependencies were added. The official shadcn Dialog was installed using the existing Radix dependency and design system.

Files modified in this task:

- `components/pricing.tsx`, `components/qr-checkout.tsx`, `components/payments.tsx`
- `components/account.tsx`, `components/session.tsx`, `components/auth-form.tsx`
- `app/globals.css`, `app/(protected)/dashboard/page.tsx`, `app/not-found.tsx`
- `lib/google-oauth.ts` (successful login destination only)
- `tests/payments.test.mjs`, `tests/google-oauth.test.mjs`, `tests/e2e/frontend.spec.ts`
- `README.md`

Files created: `components/ui/dialog.tsx`, `tests/e2e/checkout-account.spec.ts`, and this report.

Removed: `components/dashboard.tsx` (obsolete Dashboard UI).

The working tree already contained changes from earlier work, including backend changes. Those existing changes were preserved; the list above describes this refinement, not the entire working-tree diff.

## Checkout, Pricing, and Payments

Buy Credits submits only the selected package code through the existing BFF. A synchronous in-flight guard and disabled purchase buttons prevent repeated requests while creation is pending. Only a successful response opens the controlled Dialog. Pricing normally contains package cards, without an inline checkout.

The Dialog contains the package, backend amount and credits, Pending badge, sanitized QR, instructions, Open ABA Mobile, Verify payment, and Close checkout. It states that credits are added only after verification. It does not navigate away from Pricing or persist QR data. Closing clears the in-memory checkout, returns focus to the purchase button, and does not cancel the backend payment.

The exact pending toast is:

> Payment has not been confirmed yet. Complete the payment and try again.

Pending verification retains the dialog, QR, and Pending badge. It does not refresh or increment credits or create another payment. The status also remains visible inline.

Paid verification displays a success state and this toast:

> Payment confirmed. Your credits have been added.

The existing current-user request refreshes the authoritative balance. The success action is **Start generating**, linking to `/generate`.

Temporary verification failures retain checkout and use the existing safe error mapping:

> Payment verification is temporarily unavailable. Please try again.

QR image-error recovery remains inline with verification/recovery controls available. Existing sanitization and deep-link validation are unchanged. Payments history retains its lost-QR explanation and never automatically reissues Purchase. Its manual verification feedback uses the same pending/success messages and refreshes the balance only after paid confirmation.

## Dashboard, navigation, and Account

Dashboard is absent from desktop/mobile navigation and user-facing links. Generate is the first and emphasized navigation entry, followed by History, Pricing, Payments, and Account. The logo and missing-page workspace action open Generate.

`/dashboard` now performs a server-side Next.js redirect to `/generate`; the existing protected layout still applies. The old Dashboard UI is removed.

Successful password and Google login now open `/generate`. OAuth state, nonce, PKCE, token exchange, cookies, and linking behavior are unchanged. Registration still redirects to `/login?registered=1`: it does not authenticate, so redirecting it into a protected page would be misleading.

Account now groups real Available Credits and Current Plan summaries, Profile email, Connected accounts, and a Generate description action. Buy credits links to `/pricing`. Google linking and connected/error states remain intact. No analytics or generation counts were invented. Internal IDs, Google subject, JWT, and OAuth tokens are not rendered.

## Responsive and accessibility review

Automated geometry and accessibility checks cover checkout and Account at 320, 375, 390, 768, and 1440 pixels. Existing browser coverage also checks the application navigation and pages across mobile/desktop widths. No horizontal overflow was detected, including a long email test.

The Dialog fits the viewport, caps desktop width, keeps its header/footer and 44px close control accessible, and scrolls its central content vertically. QR dimensions scale safely; mobile actions stack. Account cards stack on small screens. Screenshots were reviewed at 375, 768, and 1440 pixels.

Radix supplies modal semantics, focus trapping, Escape dismissal, and accessible title/description association. Initial focus goes to the title; closing restores purchase-button focus. Persistent status accompanies Sonner feedback. Existing reduced-motion CSS applies to the subtle dialog transition; the QR itself is stable. Axe WCAG A/AA checks pass. Automated accessibility checks do not replace assistive-technology testing.

## Validation

- Unit/security tests: **20 passed**, covering OAuth security, payment/BFF behavior, duplicate-click prevention, and SEO.
- Complete Chromium browser suite: **31 passed**, including pending/paid/503, credit refresh, login, Google links, dashboard redirect, Account, QR failure recovery, responsive navigation, and accessibility.
- Lint: passed.
- TypeScript: passed.
- Production build: passed.
- Prettier: all refinement implementation/test files checked passed; existing OAuth formatting was preserved for its one-line change.
- `git diff --check`: passed.

Browser verification uses a loopback fixture backend and blocks external browser requests. No live PayWay, OpenAI, or Google request was made. The QR fixture is not a payment code.

## Security and limitations

A SHA-256 comparison against the task-start snapshot found zero changes to backend files, BFF route files, `lib/bff.ts`, or `lib/session.ts`. No API, database, payment verification, PayWay, callback, or credit logic changed. The Google OAuth helper changed only its fixed successful login redirect.

`backend/.env` and `frontend/.env.local` remain ignored and untracked. A production client-JavaScript scan found zero matches for configured secret values. Existing HttpOnly JWT and backend-owned pricing/credit authority are preserved; no localStorage authentication was introduced.

No task blocker remains. Live provider behavior was intentionally not exercised. Existing dependency-audit warnings from the earlier redesign remain outside this refinement. Next.js development-toolbar overlays are hidden in targeted screenshots so they do not obscure or intercept product controls. Nothing was committed or pushed.

## Local manual review

Run these from the repository root in separate terminals for review without live services:

```bash
# Terminal 1
cd frontend
node tests/mock-backend.mjs
```

```bash
# Terminal 2
cd frontend
BACKEND_URL=http://127.0.0.1:4311 SITE_URL=https://description.example GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= GOOGLE_REDIRECT_URI= npm run dev -- --hostname 127.0.0.1 --port 3100
```

Open `http://127.0.0.1:3100`. Sign in with `designer@example.test` and `local-test-password`. Review Pricing → Buy Credits → Verify payment, Account, and navigation at 375px, 768px, and 1440px. The local fixture verification succeeds; pending and temporary-error cases are covered by browser tests.

```bash
cd frontend
npm run lint
npx tsc --noEmit
npm test
npm run test:e2e
npm run build
git diff --check
```
