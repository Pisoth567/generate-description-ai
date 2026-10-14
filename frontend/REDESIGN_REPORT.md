# Frontend redesign review

Completed without commits or pushes. Existing backend and BFF changes were preserved byte-for-byte against the initial diff snapshot.

| # | Requested report item | Result |
|---|---|---|
| 1 | Libraries/packages | shadcn source components with Radix UI, Lucide, CVA, cn, clsx/tailwind-merge, Sonner, Motion, tw-animate-css; Tailwind PostCSS integration. Development: Playwright, axe-core/Playwright, Prettier. Exact installed versions are in package-lock.json; Next 16.4.0 and React 19.3.0 were preserved. |
| 2 | shadcn components | Button, Card, Badge, Input, Textarea, Label, Alert, Skeleton, Dropdown Menu, Separator. All are used. The native tone select and language radio inputs retain mobile/keyboard behavior. The dashboard is a custom shadcn-style shell. The unused standard Sheet was removed in favor of Animate UI's Radix Sheet. |
| 3 | Magic UI | Official registry Border Beam, limited to the illustrative landing-page preview; hidden for reduced motion. No animated business metrics. |
| 4 | Animate UI | Official Radix Sheet for mobile navigation, with a 200ms transition, reduced-motion handling, keyboard dismissal, focus return, and corrected controlled-state handling. |
| 5 | Created files | Exact inventory below. |
| 6 | Modified files | Exact inventory below. Previously untracked QR checkout/payment tests were edited, not newly invented or replaced. |
| 7 | Dashboard | Collapsible sidebar, mobile drawer, credits in header, account menu/logout; real credit/plan values and three recent records from the existing history endpoint. Generate, history, and buy-credit actions, plus inline recent-activity retry. No invented generation count. |
| 8 | Generator | Two-column editor/result, stacked mobile layout, explicit labels and constraints, visually distinct English/Khmer radio choices, live feature count/validation, tone guidance, generation loading skeleton, disabled submission, preserved paragraphs, copy feedback, saved-detail link, token/credit usage. API request contract preserved. Saved results survive credit-balance refresh errors with a balance-only retry. |
| 9 | History | Readable responsive cards, language/tone badges, UTC dates, explicit view links, pagination, loading/error/empty states, readable detail and copy action, search/language filters explicitly scoped to the current page, and restored keyboard focus after pagination. |
| 10 | Pricing | Catalog-backed cards; amounts, currency, credits, and package names remain backend-sourced. Purchase submits only package_code. No unsupported best-value label. Public preview describes credits and links to the authenticated catalog without duplicating prices. |
| 11 | PayWay QR | Responsive contained image, pending badge and persistent instructions, stacked narrow-screen actions, explicit ABA deep link and verification. Success still requires backend verification. Includes an amount/credit summary, ordered payment instructions, and QR-image failure recovery. No raw provider payload, callback change, or secret exposure. |
| 12 | Payments | Responsive cards, textual Pending/Paid/Failed/Cancelled badges with accessible contrast, dates, transaction details, verification feedback, and pagination. Return-page behavior preserved. |
| 13 | Account | Profile/plan/credits card and Google connection card; original server OAuth link remains intact. No Google subject or token fields added. |
| 14 | Login/register | Responsive branded card, labeled inputs, password constraints, clear persistent errors, original email/password requests, Google endpoint link, and divider, plus a branded skeleton during auth loading. |
| 15 | Landing | Navbar, value proposition, labeled illustrative preview, benefits, how-it-works, English/Khmer messaging, credit overview, factual account/payment messaging, final CTA and footer. Branded 404 and public error recovery pages are also included. No testimonials, ratings, sales promises, customer counts, or business mock records. |
| 16 | Responsive | Browser overflow and flow checks at 320, 375, 390, 768, 1024, and 1440px. Screenshots reviewed at 375, 768, and 1440px for landing, login, dashboard, generator, history/detail, pricing/QR, payments, and account. Register and payment return also tested. |
| 17 | Accessibility | Visible focus, skip link, explicit labels/help text, 44px primary controls, Radix focus management, descriptive links, textual statuses, system dark mode, reduced motion. Axe WCAG A/AA scans found no violations on public/app pages in light and dark mode. Actual Khmer text reviewed with installed Noto Sans Khmer fallback. This is automated/browser QA, not a formal accessibility certification. |
| 18 | Metadata | Public title/description, Open Graph and Twitter summary metadata; server-only SITE_URL provides canonical URLs. Login/register have relevant titles and noindex. Private route titles contain no personal data and inherit noindex/nofollow. Added product SVG icon. |
| 19 | Robots/sitemap | App Router robots.ts blocks API/private paths; sitemap.ts lists only the landing page when SITE_URL is configured. Auth/private/pricing routes are excluded. Invalid/unset origins never create localhost canonical/sitemap URLs. |
| 20 | Structured data | Escaped SoftwareApplication JSON-LD containing only product name, category, platform, supported languages and description; configured origin optional. No offers, ratings, or organization claims. |
| 21 | Performance | Landing/layout remain Server Components. Existing BFF/server auth boundaries remain. Motion is limited to the landing effect and authenticated drawer, not a global animation provider. No remote fonts/images or large image assets. System fonts support Khmer without a build-time font download. |
| 22 | Tests | npm test: 19 tests passed across OAuth, payment and SEO suites. npm run test:e2e: 21 tests passed, including saved-generation balance recovery, feature validation, history filters, missing-page/QR recovery, browser interaction, six-width audit, error/loading/empty states, security-sensitive contracts, metadata, dark mode and axe scans. |
| 23 | Lint | npm run lint passed, zero warnings/errors. |
| 24 | TypeScript | npx tsc --noEmit passed. |
| 25 | Production build | npm run build passed. Initial sandbox port restriction cached a Turbopack failure; moving that disposable cache to /tmp and rebuilding with permission resolved it. |
| 26 | Security review | backend/.env and frontend/.env.local remain ignored/untracked. Backend/BFF/OAuth logic unchanged. HttpOnly cookie and no-token-DOM checks passed. No localStorage authentication. Final generated browser JS scan found no configured secret values or sensitive identifiers. No secrets printed. |
| 27 | Backend modifications | None by this task. Pre-existing backend changes remain intact. |
| 28 | Live requests | No live OpenAI, Google OAuth, PayWay, or payment operations. Browser tests used only a loopback fixture backend and blocked external browser requests. External network access was limited to documentation and package/browser downloads/audit. |
| 29 | Warnings/limits | Set SITE_URL to the real HTTPS public origin before production build. Current npm audit reports five high-severity entries in the existing development ESLint dependency chain (braces → micromatch → fast-glob → Next ESLint); the suggested forced downgrade was not applied. Live providers, real QR scanning, Safari and Firefox were not tested. Test QR is deliberately non-payable/non-scannable. System fonts depend on platform Khmer font availability. No blocking implementation issues remain. |
| 30 | Manual review commands | See exact commands below; the mock review setup requires no live credentials. |

Additional checks: Prettier check passed on the changed frontend implementation/config/test files. git diff --check passed. Test artifacts are ignored under frontend/test-results/.

## Created files

```text
frontend/components/auth-loading.tsx
frontend/app/not-found.tsx
frontend/app/error.tsx
frontend/REDESIGN_REPORT.md
frontend/app/icon.svg
frontend/app/robots.ts
frontend/app/sitemap.ts
frontend/components.json
frontend/components/animate-ui/components/radix/sheet.tsx
frontend/components/animate-ui/primitives/radix/sheet.tsx
frontend/components/brand.tsx
frontend/components/notifications.tsx
frontend/components/ui/alert.tsx
frontend/components/ui/badge.tsx
frontend/components/ui/border-beam.tsx
frontend/components/ui/button.tsx
frontend/components/ui/card.tsx
frontend/components/ui/dropdown-menu.tsx
frontend/components/ui/input.tsx
frontend/components/ui/label.tsx
frontend/components/ui/separator.tsx
frontend/components/ui/skeleton.tsx
frontend/components/ui/textarea.tsx
frontend/hooks/use-controlled-state.tsx
frontend/lib/get-strict-context.tsx
frontend/lib/seo.ts
frontend/lib/utils.ts
frontend/playwright.config.ts
frontend/postcss.config.mjs
frontend/tests/e2e/frontend.spec.ts
frontend/tests/mock-backend.mjs
frontend/tests/seo.test.mjs
```

## Modified files

```text
frontend/.env.example
frontend/.gitignore
frontend/README.md
frontend/app/(protected)/account/page.tsx
frontend/app/(protected)/dashboard/page.tsx
frontend/app/(protected)/error.tsx
frontend/app/(protected)/generate/page.tsx
frontend/app/(protected)/history/[id]/not-found.tsx
frontend/app/(protected)/history/[id]/page.tsx
frontend/app/(protected)/history/page.tsx
frontend/app/(protected)/layout.tsx
frontend/app/(protected)/loading.tsx
frontend/app/(protected)/payments/page.tsx
frontend/app/(protected)/payments/return/page.tsx
frontend/app/(protected)/pricing/page.tsx
frontend/app/globals.css
frontend/app/layout.tsx
frontend/app/login/page.tsx
frontend/app/page.tsx
frontend/app/register/page.tsx
frontend/components/account.tsx
frontend/components/auth-form.tsx
frontend/components/dashboard.tsx
frontend/components/generator.tsx
frontend/components/history.tsx
frontend/components/payments.tsx
frontend/components/pricing.tsx
frontend/components/qr-checkout.tsx
frontend/components/session.tsx
frontend/components/ui.tsx
frontend/package-lock.json
frontend/package.json
frontend/tests/payments.test.mjs
```

Existing changes in frontend/lib/bff.ts, frontend/lib/errors.ts, frontend/lib/types.ts and backend/ were not touched by this task.

## Manual visual review without live services

From the repository root, in terminal 1:

```bash
cd frontend
node tests/mock-backend.mjs
```

From the repository root, in terminal 2:

```bash
cd frontend
BACKEND_URL=http://127.0.0.1:4311 SITE_URL=https://description.example GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= GOOGLE_REDIRECT_URI= npm run dev -- --hostname 127.0.0.1 --port 3100
```

Open http://127.0.0.1:3100. Sign in with `designer@example.test` / `local-test-password`. These credentials are only for the isolated fixture server. Inspect 375px, 768px, and 1440px plus the 320px edge case. Use OS/browser light/dark and reduced-motion settings. Test QR cannot create a payment. Stop both terminals with Ctrl+C.

Automated review, from frontend (stop the manual servers first):

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npx playwright install chromium
npm run test:e2e
git diff --check
```

## Installation references

- [shadcn manual setup](https://ui.shadcn.com/docs/installation/manual)
- [Magic UI Border Beam](https://magicui.design/docs/components/border-beam)
- [Animate UI Radix Sheet](https://animate-ui.com/docs/components/radix/sheet)

Installed Next.js documentation under node_modules/next/dist/docs was used for Tailwind/PostCSS, metadata, robots, and sitemap conventions. Current registry source was installed using shadcn@latest; local accessibility adaptations are documented in README.md.
