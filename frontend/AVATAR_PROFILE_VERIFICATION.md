# Built-in avatars and Profile

## Implementation

- One nullable `users.avatar_id VARCHAR(32)` preference; no name column or other user-schema additions.
- Alembic revision `a31c8e902b64`, parent `f20b2c3d4e50`. Upgrade adds only this column; downgrade drops only it. Existing rows default to NULL. No developer database migration was performed.
- Server allowlist: `avatar-01`, `avatar-02`, `avatar-03`, `avatar-04`, `avatar-05`, `avatar-06`, `avatar-07`, `avatar-08`, `avatar-09`, `avatar-10`, `avatar-11`, `avatar-12`. Tests compare these IDs with the actual frontend JPG filenames.
- `PATCH /api/profile/avatar` accepts a required `avatar_id` containing an allowlisted ID or null. Existing authenticated-user dependency enforces active, verified accounts. Extra request fields (including `user_id`) are forbidden. Only the current user is updated. Invalid input returns 422; missing auth returns 401.
- Safe `UserResponse`, `/api/auth/me`, frontend user type, and BFF response include `avatar_id`. Password hashes and Google subjects remain excluded. PATCH uses the existing BFF origin, authentication, JSON body-size and safe-error protections.
- Shared `UserAvatar` uses only allowlisted local image sources, circular fixed dimensions and object-cover. Missing/unknown IDs or failed images show the first letter/number of the email local part, uppercased, without inventing a name. No layout shift.
- Profile is a wider rounded card with a mint accent, large avatar, email identity, verification and conditional Google-connected badges, member date, and the existing logout action. The extra Google-link action was removed from Profile to match the requested content; OAuth routes/security remain unchanged. Language/theme controls stay in navigation. Existing Koh Santepheap and light/dark architecture are preserved.
- The existing shadcn/Radix Dialog offers 12 real buttons (3 columns on small screens, 4 on larger screens), pressed state, check indicator, visible focus, Use initials and Save. Save persists through PATCH, updates the session and navbar immediately, closes the dialog and shows a translated toast. Failure retains the dialog and shows a fixed safe error.
- English and Khmer translations cover active avatar labels, instructions, statuses, save/error feedback, and logout. Dialog close text can be localized without changing existing callers.

## Files created

Backend:
- `app/core/avatars.py`
- `app/api/profile.py`
- `alembic/versions/a31c8e902b64_add_user_avatar_id.py`
- `tests/test_avatars.py`

Frontend:
- `app/api/profile/avatar/route.ts`
- `components/user-avatar.tsx`
- `lib/avatars.ts`
- `tests/avatars.test.mjs`
- `tests/e2e/profile-avatar.spec.ts`
- `AVATAR_PROFILE_VERIFICATION.md`

## Files modified

Backend: `app/main.py`, `app/models/user.py`, `app/schemas/user.py`, `tests/test_phase2.py`.
The legacy migration test supplies/removes the new column in its disposable fixture so its existing pre-cleanup generation check can still use the current ORM. Historical migration files are unchanged.

Frontend: `components/account.tsx`, `components/session.tsx`, `components/ui/dialog.tsx`, `lib/backend.ts`, `lib/bff.ts`, `lib/client.ts`, `lib/translations.ts`, `lib/types.ts`, `tests/e2e/checkout-account.spec.ts`, `tests/mock-backend.mjs`, `tests/phase1.test.mjs`.

## Safety

No Google profile image integration, Gravatar, uploads, remote avatar URLs, base64 images, or backend image copies were added. PostgreSQL stores only an optional ID. Frontend source construction and backend input validation both constrain IDs. No auth/OTP/Google security, generation, history ownership, rate-limit, SMTP, billing-cleanup migration, landing-page or theme-architecture changes were made. No commit, push, or deploy was performed. Tests use local fixtures and disabled/mocked auth, AI and email providers.

## Verification

Continuation audit (2026-10-22):

- Already present at continuation: model/schema, migration, authoritative backend allowlist and API, BFF PATCH support, shared avatar renderer, redesigned Profile, picker, localized strings, shared navbar/session updates, and initial backend/unit/browser tests. These were preserved.
- Gaps repaired: missing/null email handling; extra Profile Google-link action; weak BFF sanitization assertion; JavaScript scheme rejection coverage; exact picker asset coverage; reset-after-reload and secure logout assertions; browser URL normalization and animation timing assumptions. No replacement of working backend/auth architecture.
- Added isolated Next output configuration for verification without stopping the developer server. Ignore generated verification outputs in Git/ESLint; retain generated type paths in TypeScript configuration.
- No new source files were created during this continuation. All files in the “Files created” list above were already untracked when this continuation began.
- Continuation edits: `backend/tests/test_avatars.py`; `frontend/components/account.tsx`, `lib/avatars.ts`, `tests/avatars.test.mjs`, `tests/phase1.test.mjs`, `tests/e2e/checkout-account.spec.ts`, `tests/e2e/profile-avatar.spec.ts`, `.gitignore`, `next.config.ts`, `playwright.config.ts`, `eslint.config.mjs`, `tsconfig.json`, and this report.
- Existing unrelated `components/ui/marquee-demo.tsx` changes were preserved without modification.

Checks:

- Backend compileall: PASS. pip check: PASS.
- Backend unittest: 76/76 PASS, no skips, using a disposable UTF-8 PostgreSQL database on port 55439. Email/AI/Google providers mocked/disabled.
- Migration: upgrade, data snapshots (users, generations, OTP, auth fields and attempts), downgrade and re-upgrade PASS in disposable schemas. Single head `a31c8e902b64`. Isolated `alembic check`: PASS, no new upgrade operations.
- Developer `alembic check`: FAIL, “Target database is not up to date.” This is intentional pending migration, not silently fixed. No migration was applied to the developer database.
- Frontend unit tests: 4 test files PASS, including allowlist/asset parity, initials, BFF authentication/origin checks and sensitive-field stripping.
- ESLint: PASS with two pre-existing unused-import warnings in `components/auth-form.tsx` (`PreferenceControls`, `Brand`).
- TypeScript: PASS.
- Production build: PASS using `NEXT_TEST_DIST_DIR=.next-verification npm run build`. A fresh output directory resolved cached Turbopack sandbox worker-port failures; production code and build command are unchanged.
- Full browser suite initially: 17 passed, 6 failed. Two avatar test failures were assertion/timing bugs fixed in this continuation. Four pre-existing landing tests fail because `locator("h1")` matches both the landing title and “Project Members”; both headings exist in HEAD. Landing design/tests were left untouched per scope.
- Final profile browser results: 3/3 PASS (46.5 seconds), including complete save/failure/reset/reload/logout behavior and the full locale/theme/width matrix.
- Existing theme-toggle hydration warnings are emitted by `components/ui/animated-theme-toggler.tsx:329`; theme code was not modified. They are not avatar state or API failures.
- Responsive matrix: 320, 375, 390, 768, 1024, 1200, 1440px, English/Khmer and Light/Dark; no page/dialog horizontal overflow. Dialog grid is 3 columns on small screens and 4 on larger screens.
- Accessibility: axe scans of Profile/dialog, keyboard selection, pressed state/check indicator, Escape and return focus; PASS with zero axe violations in tested states. Desktop English/light and mobile Khmer/dark Profile plus Khmer/light picker screenshots were visually inspected: balanced layout, readable text, no clipping. Screenshots are saved under ignored `test-results/` for visual inspection.
- Branch remains `feature/profile-avatar-system`; no reset, restore, stash, branch switch, commit or push.

Product contract:

- `avatar_id` is nullable VARCHAR(32); NULL means initials. IDs only, never bytes/URLs/paths.
- Allowlist exactly matches twelve JPG assets: `avatar-01` through `avatar-12`.
- `PATCH /api/profile/avatar` accepts `{ "avatar_id": "avatar-04" }` or null, rejects extra fields and unsafe/unknown IDs, and updates only the current active verified user through the existing auth dependency.
- PATCH and `/api/auth/me` return the sanitized User contract including `avatar_id`, email, verification timestamp, `google_linked`, language and timestamps. No Google subject, password hash, OTP digest or token is exposed.
- Shared fixed-size circular renderer uses safe local sources and image-error fallback. Email local-part supplies a letter/number; missing/unusable values produce `?`. No inferred real name.
- Save updates shared current-user state and both Profile/navbar immediately, closes on success, and shows translated success feedback. Failure preserves selection and displays a fixed localized error. Reload reads the persisted avatar; Use initials persists null.
- Profile displays only avatar/change action, email, verification, conditional Google-connected status, member date and logout. Preferences remain in navigation.
- Logout calls the existing shared cookie-clearing BFF flow, then navigates to login. No new auth endpoint or local-only logout.
- Active avatar/Profile strings have English/Khmer coverage. Light/Dark use existing theme variables, no System option.


- Final `git diff --check`: PASS. No required Profile/avatar implementation items remain. Developer database migration remains intentionally unapplied; the four unrelated landing-test failures and existing theme hydration/unused-import warnings remain.

## Repository verification cleanup (2026-10-22)

This follow-up supersedes the previous landing-failure, lint-warning and theme-toggle-hydration findings above.

Changes were limited to:
- `components/auth-form.tsx`: removed unused `PreferenceControls` and `Brand` imports; auth behavior unchanged.
- `components/preferences.tsx`: gated the effective theme on the existing hydration-safe mounted snapshot. Server and first client render now share the same icon and label; after mount, the stored next-themes preference is used. Light/Dark-only behavior and the Magic UI animation implementation are preserved.
- `tests/e2e/landing.spec.ts`: replaced ambiguous `h1` lookup with an exact localized heading role/name and level-1 selector. All responsive, accessibility and static-page assertions remain. Landing markup/design unchanged.
- Added `tests/e2e/theme-hydration.spec.ts`: two regressions exercise persisted Light/Dark, reload, animated toggle, opposing OS theme, landing and authenticated Profile; capture console/page hydration errors.
- Updated this audit. Backend, migrations and Profile/avatar implementation unchanged in this follow-up.

Final verification:
- `npm run lint`: PASS, zero warnings/errors.
- `npx tsc --noEmit`: PASS.
- `NEXT_TEST_DIST_DIR=.next-verification npm run build`: PASS (isolated output preserves the running developer server).
- `npm test`: all 4 configured unit/security test files PASS.
- `npm run test:e2e`: all 25 browser/accessibility tests PASS (3.9 minutes), including all four formerly failing landing cases and both new theme hydration regressions.
- Separate `npm run test:e2e -- tests/e2e/profile-avatar.spec.ts`: 3/3 PASS (43.9 seconds).
- `git diff --check`: PASS.
- No theme-toggle hydration mismatch observed. One separate non-theme warning appeared in the full run: Radix-added `aria-hidden` / `data-aria-hidden` attributes on Generator background content during hydration. It did not fail any test and was not reproduced in the dedicated theme or Profile runs. No unrelated Generator code was changed. Existing development-server image-loading advisories also remain; these are not lint errors.
- Branch remains `feature/profile-avatar-system`. No reset, restore, commit, push, branch switch or migration application.
