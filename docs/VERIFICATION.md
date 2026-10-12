# Verification record

Checkpoint status for moving Tuition Desk from the claude.ai artifact to GitHub + Vercel + Supabase.
Only results that were actually observed are marked passed.

| Checkpoint | Status | Evidence |
| --- | --- | --- |
| A. Source inspected, baseline recorded | ✅ passed | Baseline of the previous project: lint clean, 28/28 tests, build OK. It was 4 feature rounds behind the live artifact. |
| B. Repository secured and pushed | ⏳ blocked | Committed locally; pushing needs a GitHub account linked to the session. Safety check passes (no secrets, no backups). |
| C. Supabase verified | ⏳ blocked | Client verified against a simulated Supabase API (21/21). Real project, RLS and auth redirects need access to a Supabase project. |
| D. Vercel production deployment | ⏳ blocked | `vercel.json` and build guard ready and tested locally; needs Vercel access. |
| E. Live auth and workflows | ⏳ blocked | Depends on C and D. |
| F. Data migration | ⏳ blocked | The artifact's database holds no records for the owner's account (profile, students, months and university collections all empty when read). A backup exported from the artifact by the user is needed. |
| G. Final regression | ✅ passed locally | See below. |

## What changed in this round

- Brought the standalone app to parity with the live artifact (Due card for the previous calendar month, teaching time from
  completed classes' start/end, automatic upgrade of older time records, calendar stability, mobile reminders sheet,
  mark-all-as-read, subject dropdown, historical classes, profile redesign). Modules were regenerated from the artifact code;
  only the standalone parts (Supabase backend, sign-in, file-download backup, account section) differ.
- Hosting moved from GitHub Pages to Vercel: `vercel.json`, Pages workflow removed, `base: '/'`.
- A Vercel build fails if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing; the browser-only preview backend is
  removed from production bundles entirely (checked: 0 occurrences in `dist/`).
- CI runs on every push (including `main`) and pull request: lint, unit tests, repository safety check, build, smoke test.
- `scripts/check-repo.mjs` blocks secrets, `.env` files, backups/exports and database dumps.
- Removed two stray test files (`backup.json`, `bad.json`, automated-test data only) that were in the earlier zip.

## Failures found and fixed

| Failure | Cause | Fix |
| --- | --- | --- |
| Lint: `DEFAULT_PROFILE` undefined after regenerating modules | Import generator treated `...NAME` (spread) as property access | Fixed the matcher, regenerated |
| 1 unit test failed | Test encoded the old rule (completed class without a time record = 0 h) | Updated to the agreed rule (end − start); added tests for Due, year change, record upgrade |
| Lint errors in `scripts/*.mjs` | ESLint config only covered `.js` | Config covers `.mjs` with Node globals |
| Smoke test flagged preview backend in production bundle | Backend selection wasn't tree-shakeable | `makeBackend` only references it under `import.meta.env.DEV` |
| e2e expected 6 Mondays, app showed 5 | Test arithmetic was wrong (1 Sep–10 Oct 2026 has 5 Mondays) | Fixed the test |

## Local results (last run)

- `npm run verify`: lint clean · 32/32 unit tests · safety check passed · build OK · smoke test passed
- `e2e/regression.py`: 20/20 · `e2e/calendar_and_reminders.py`: all operations keep view, date, scroll; 0 unrelated events moved;
  reminders panel fits at 1300/820/390/360 px, mark-all-as-read persists
- `e2e/due.py`: Oct 2026 → ৳7,000 (September), Nov 2026 → ৳12,500 (October), Jan 2027 → ৳23,000 (December 2026)
- `e2e/headers_mobile.py`: all 9 pages, no overflow at 360 px
- `e2e/supabase_sim.py` (production build): 21/21, including restore of an artifact export (4 students, 57 classes,
  6 payments, 4 university classes; totals match, older time record upgraded) and a second account seeing none of the data

## Not verified (needs real accounts)

Real Supabase RLS, email confirmation and password-reset redirects, realtime sync between devices, Vercel build and
production URL over HTTPS, automatic deploy on push, and migration of the owner's real data.
