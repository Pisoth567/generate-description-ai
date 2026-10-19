> Historical Phase 1 record. Current product behavior and setup are documented in [Phase 2](PHASE2_PRODUCT_SIMPLIFICATION.md).

# Phase 1 verification and continuation report

Reviewed on 2026-10-18 on `feature/core-product-redesign`. No commit, push, deployment, live OpenAI request, live Google OAuth exchange, verification email, or PayWay transaction was performed. All external service boundaries in tests were mocked; browser tests used the local fixture backend.

## 1. Work already present when this session began

The repository already contained 53 modified tracked files and 26 untracked files. The previous session implemented the additive migration, OTP/email services, database limiter, image validator and multimodal request construction, free generation, the redesigned Generate/History/Profile/landing pages, category combobox, preferences/theme providers, Khmer dictionary, payment deactivation, route redirects, BFF changes and substantial tests. The existing logo and archived pre-redesign browser specifications were preserved. The archive files exactly match their corresponding HEAD versions.

The initial status, diff statistics, full diff and untracked inventory were inspected, followed by focused reads of implementation, tests and configuration. No existing work was reverted or replaced wholesale.

## 2. Work completed in this session

- Corrected the draft migration's security flaw: existing password-only accounts are no longer declared verified without inbox ownership proof. Existing Google-linked accounts retain verified status; all data is preserved.
- Fixed Google linking success/failure redirects to `/profile`, preserving query status that the old `/account` redirect discarded.
- Added authenticated navigation language controls and narrow-screen wrapping. Kept generated output language independent.
- Completed Khmer labels for category selection/search, copy feedback and errors, loading, error/not-found pages, skip navigation, output language names and notification controls. Dates use the UI locale when the browser supports it.
- Removed obsolete credit fields from the generation result type and the shared insufficient-credit UI error.
- Made malformed BFF multipart input return a safe 400 before backend access.
- Fixed binary multipart fixture handling and removed its obsolete generation credit fields.
- Added verification race, failed delivery rollback, unverified-token rejection, chunked body limits, malformed multipart and Khmer navigation/category/history-copy regressions.
- Corrected test assumptions about multipart CRLF, hydration timing and Next.js's retained hidden pages.
- Recreated an isolated temporary PostgreSQL database, ran the requested checks and completed this report.

## 3. Files created and modified

The complete final working-tree inventory appears below. Most entries predate this continuation; this session specifically edited the migration and its test, `backend/tests/test_phase1.py`, frontend error/not-found/layout pages, account/category/generator/history/session/preferences/UI/notifications components, BFF/client/errors/Google OAuth/types/translations modules, browser and Phase 1 tests, mock backend and these reports. `PHASE1_VERIFICATION_REPORT.md` is newly created this session. No unrelated user files were removed.

## 4. Migration IDs

Phase 1 revision: `e10a1b2c3d40`; parent: `7b81e2ac940d`. This remains the single additive Phase 1 migration. It adds email verification, UI locale and rate-limit storage only. `credits`, `payments`, `password_hash`, `google_sub`, users and generations remain intact. The corrected backfill applies only to existing `google_sub IS NOT NULL` accounts; existing password-only users verify via resend before login. This uncommitted migration was tested only in disposable local databases/schemas, not applied to the configured application database.

## 5. Email verification

Email/password registration issues a six-digit ownership OTP, not registration 2FA. HMAC-SHA256 stores only a keyed digest scoped to the account; codes expire after ten minutes, allow five failed checks, have a 60-second resend cooldown and are consumed once. PostgreSQL user-row locks serialize verification/resend. Registration and challenge changes roll back on delivery failure. Verification never grants a session automatically. Google sign-in still validates signed ID tokens and strict `email_verified`; Google users do not receive OTPs. The email-service boundary has a Resend adapter and is mocked in tests. Real delivery requires server-only provider configuration and an independent verification secret.

## 6. Rate limiting

Defaults are five requests per rolling minute and fifty per rolling day per authenticated verified account. PostgreSQL locks serialize count-and-reserve across workers/processes. Reservations commit before OpenAI and failures consume capacity. Requests over the limit return safe 429 without contacting AI. Tests cover concurrent requests, minute/day windows and separate accounts. Old attempts are pruned for active accounts; dormant-account cleanup is Phase 2 maintenance.

## 7. Image validation and multimodal AI

Optional JPEG, PNG and WebP uploads are limited to 5 MiB, validated by actual format/MIME/extension, verified and fully decoded with Pillow, and re-encoded without metadata. SVG, fake/malformed content, animation and oversized dimensions are rejected. The inherited decoded-pixel cap is 1,310,720 pixels; large photographs may need resizing even below the file-size limit. Generation bodies are capped at 6 MiB in both backend and BFF, including bodies without Content-Length. Images use temporary/in-memory handling and never enter persistent application storage or history. Validated images accompany text in one OpenAI multimodal request with `store=False`; text-only requests still work. The prompt prohibits unsupported visual specifications and treats image text as untrusted. Model output still warrants human review for accuracy.

## 8. Free generation

Zero legacy credits do not block generation. Credits are neither deducted nor refilled; successful generation stores history without a billing transaction. The generation API has no 402 insufficient-credit branch. Existing credit columns and deprecated service code remain for Phase 2.

## 9. Categories

The Radix/cmdk shadcn-style combobox supports keyboard selection, predefined categories, English or Khmer label search, and custom entries such as `Use "Handmade Khmer Products"`. The backend receives an ordinary string. Translated predefined display labels preserve their normal category values.

## 10. English/Khmer UI

Authenticated UI language persists to the account and survives reloads; public pages use a non-sensitive local preference. Navigation and Profile can change it. Generated output remains a separate English/Khmer field. Active application labels and fallback states are translated. Brand names, user content and the explicitly required exact English copy-success toast are intentionally preserved.

## 11. Theme

Light/Dark/System use next-themes with shadcn CSS variables and persistent non-sensitive preferences. Hydration-safe controls and reduced-motion support remain. The existing Magic UI landing border is retained.

## 12. History copying

History cards and details retain owner-only data access and top-right Copy buttons. Only the complete generated description is copied, including from truncated cards. The exact success toast remains `Description copied to clipboard.` in either UI language. Copy failures are safe and localized. Browser tests verify clipboard content for cards, details and generation output.

## 13. Profile

Profile shows email, verification status, Google connection/linking, member date, UI language and theme. No plan, credits or payment information is rendered. Google status returns to Profile without losing callback query parameters.

## 14. Payment and credit deactivation

Active navigation is Generate, History, Profile, language/theme controls and Logout. Dashboard/Pricing/Payments routes redirect to Generate; Account redirects to Profile. `PAYMENTS_ENABLED` defaults to false, so payment routes and callback are unregistered and fail closed. Payment models, database tables, PayWay services, legacy BFF/components and their unit/backend security tests remain. The landing page has no credit/payment marketing.

## 15. Backend tests

`python -m unittest discover -s tests -v`: **105 passed**, including real PostgreSQL transactions/concurrency, OTP digest/expiry/attempts/cooldown/consumption, failed-delivery rollback, authorization, Google verification/linking, zero-credit generation, rate limits, images, mocked multimodal calls, body limits, history ownership, retained payment security tests and additive migration upgrade/downgrade. Migration tests run in their own disposable schema and explicitly preserve passwords, Google subjects, credits and history.

`python -m compileall -q app tests alembic`: passed. `python -m pip check`: no broken requirements.

## 16. Frontend tests

`npm test`: **26 passed**, covering Google state/nonce/PKCE/cookies and safe redirects, BFF origin/session/body checks, multipart forwarding and malformed input, verification endpoints, SEO and retained legacy payment component/security checks.

`npm run test:e2e`: **12 passed**, using local fixtures and Chromium. Covers registration/verification/resend, Google entry/link controls, generation and custom categories, images, output languages, rate-limit errors, history/copy, deprecated routes, Profile, persisted Khmer navigation, all theme choices, logout, six viewport widths (320/375/390/768/1024/1440) and axe accessibility checks. Archived legacy purchase-flow specifications are documentation, not active tests of the deactivated product.

## 17. Lint, typecheck and build

`npm run lint`: passed without warnings. `npx tsc --noEmit`: passed. `npm run build`: passed with the default Turbopack builder. The initial sandbox build failed because CSS workers could not bind a local port; that failure remained cached on the first elevated retry. Moving the generated Turbopack cache aside and rerunning with permission resolved it. A Webpack production build also passed during diagnosis. No source configuration was changed to bypass build checks. `git diff --check`: passed.

## 18. Alembic

On the isolated local database: `alembic current` and `alembic heads` both report `e10a1b2c3d40 (head)`. `alembic check`: `No new upgrade operations detected.` The migration test independently verifies the corrected backfill from the parent revision and non-destructive rollback in a disposable schema. No deployment/application database was migrated.

## 19. Security review

Preserved HttpOnly JWT cookies, BFF-only bearer tokens, origin checks, Google OAuth state/nonce/PKCE, server-side signed identity verification, password hashing, owner-only history and sanitized errors. No authentication token is put into localStorage; localStorage holds only presentation preferences, and sessionStorage temporarily holds the verification email. Password/OTP validation errors do not echo submitted values. No secrets were printed or added to client code. The legacy verification backfill bypass and Google callback wiring were corrected. Tests never call real providers.

## 20. Remaining setup and Phase 2

No known Phase 1 implementation/test blockers remain. Before real use, configure transactional email and its dedicated secret, review/apply the migration to a backed-up target database, and confirm the configured AI model supports images. These operational actions were not performed. Existing password-only accounts must verify ownership after migration; preserve the verification/resend UI during rollout.

Phase 2: retire dormant payment/credit/plan code and tables through a separate data-retention decision, remove obsolete legacy tests/response fields and billing settings, schedule dormant rate-limit record cleanup, and consider an email delivery outbox and verified email-change flow. The previous report mentions an ESLint dependency advisory; this session did not perform a new network audit or dependency upgrade. Native-speaker review of Khmer copy remains useful editorial QA.

## Reproducing the isolated backend checks

The helper `backend/scripts/phase1-test-env.sh` uses only the temporary localhost database at port 55439 with test credentials and disabled providers. This session initialized `/tmp/phase1-redesign-pg` (UTF-8), then started it with:

```bash
/usr/lib/postgresql/18/bin/pg_ctl -D /tmp/phase1-redesign-pg -l /tmp/phase1-redesign-pg.log -o '-h 127.0.0.1 -p 55439 -k /tmp' start
/usr/lib/postgresql/18/bin/createdb -h 127.0.0.1 -p 55439 phase1_utf8
cd backend
scripts/phase1-test-env.sh .venv/bin/alembic upgrade head
```

If the temporary directory no longer exists, initialize it first with `initdb -D /tmp/phase1-redesign-pg -A trust --encoding=UTF8 --no-locale`. The instance binds only localhost and is for disposable tests, never deployment. Start/create commands are needed only when the instance/database does not already exist. Full check commands are in `PHASE1_PRODUCT_REDESIGN.md`.

## Final working-tree inventory

Modified tracked files:

- `backend/.env.example`
- `backend/app/api/auth.py`
- `backend/app/api/deps.py`
- `backend/app/api/generate.py`
- `backend/app/core/config.py`
- `backend/app/main.py`
- `backend/app/models/__init__.py`
- `backend/app/models/user.py`
- `backend/app/schemas/auth.py`
- `backend/app/schemas/generation.py`
- `backend/app/schemas/user.py`
- `backend/app/services/ai_service.py`
- `backend/app/services/auth_service.py`
- `backend/app/services/generation_service.py`
- `backend/app/services/google_auth_service.py`
- `backend/app/services/user_service.py`
- `backend/requirements.txt`
- `backend/tests/test_auth.py`
- `backend/tests/test_generation.py`
- `backend/tests/test_google_auth.py`
- `backend/tests/test_payments.py`
- `backend/tests/test_users.py`
- `frontend/app/(protected)/account/page.tsx`
- `frontend/app/(protected)/dashboard/page.tsx`
- `frontend/app/(protected)/error.tsx`
- `frontend/app/(protected)/history/[id]/not-found.tsx`
- `frontend/app/(protected)/payments/page.tsx`
- `frontend/app/(protected)/payments/return/page.tsx`
- `frontend/app/(protected)/pricing/page.tsx`
- `frontend/app/error.tsx`
- `frontend/app/globals.css`
- `frontend/app/layout.tsx`
- `frontend/app/not-found.tsx`
- `frontend/app/page.tsx`
- `frontend/app/robots.ts`
- `frontend/components/account.tsx`
- `frontend/components/animate-ui/components/radix/sheet.tsx`
- `frontend/components/auth-form.tsx`
- `frontend/components/brand.tsx`
- `frontend/components/generator.tsx`
- `frontend/components/history.tsx`
- `frontend/components/notifications.tsx`
- `frontend/components/session.tsx`
- `frontend/components/ui.tsx`
- `frontend/lib/backend.ts`
- `frontend/lib/bff.ts`
- `frontend/lib/client.ts`
- `frontend/lib/errors.ts`
- `frontend/lib/google-oauth.ts`
- `frontend/lib/seo.ts`
- `frontend/lib/session.ts`
- `frontend/lib/types.ts`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/tests/e2e/checkout-account.spec.ts`
- `frontend/tests/e2e/frontend.spec.ts`
- `frontend/tests/google-oauth.test.mjs`
- `frontend/tests/mock-backend.mjs`
- `frontend/tests/payments.test.mjs`

New/untracked files (including inherited files):

- `PHASE1_PRODUCT_REDESIGN.md`
- `PHASE1_VERIFICATION_REPORT.md`
- `backend/alembic/versions/e10a1b2c3d40_phase1_verification_limits.py`
- `backend/app/core/body_limit.py`
- `backend/app/models/verification.py`
- `backend/app/services/email_service.py`
- `backend/app/services/image_service.py`
- `backend/app/services/rate_limit_service.py`
- `backend/app/services/verification_service.py`
- `backend/scripts/phase1-test-env.sh`
- `backend/tests/helpers.py`
- `backend/tests/test_phase1.py`
- `backend/tests/test_phase1_migration.py`
- `frontend/app/(protected)/profile/page.tsx`
- `frontend/app/api/auth/preferences/route.ts`
- `frontend/app/api/auth/resend-verification/route.ts`
- `frontend/app/api/auth/verify-email/route.ts`
- `frontend/app/no background.png`
- `frontend/app/verify-email/page.tsx`
- `frontend/components/category-combobox.tsx`
- `frontend/components/landing.tsx`
- `frontend/components/preferences.tsx`
- `frontend/components/verify-email.tsx`
- `frontend/lib/translations.ts`
- `frontend/tests/legacy/checkout-account.spec.ts.txt`
- `frontend/tests/legacy/pre-phase1-frontend.spec.ts.txt`
- `frontend/tests/phase1.test.mjs`
