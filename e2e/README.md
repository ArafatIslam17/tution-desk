# Browser end-to-end checks

Python + [Playwright](https://playwright.dev/python/) scripts that drive the app in a real Chromium. They are not part of
CI (CI runs lint, unit tests, the repository safety check, the build and an HTTP smoke test); run them before a release.

```bash
pip install playwright && python -m playwright install chromium   # once
```

| Script | Server it expects | What it checks |
| --- | --- | --- |
| `regression.py` | `npm run dev` on port 5173 (local preview mode) | students, schedules, teaching time, payments, university, backup/restore, mobile navigation |
| `calendar_and_reminders.py` | port 5173 | calendar keeps view/date/scroll through add/edit/complete/cancel/reschedule/delete; reminders panel at 4 widths; mark-all-as-read persists |
| `due.py` | port 5173 | Due = previous calendar month only, including the December → January change |
| `headers_mobile.py` | port 5173 | every page header at 360 px, no sideways scrolling |
| `layout.py <outdir> [--shots]` | port 5173 | 11 widths (320 → 2560 px), empty and sample data, every page: no sideways scrolling, sidebar never overlaps, balanced left/right margins, cards on screen, nothing under the bottom bar, 40 px+ touch targets on touch screens, reminders and dialogs fit |
| `supabase_sim.py` | production build on port 4319, built with `VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_ANON_KEY=test`, then `npx vite preview --port 4319` | sign-up/in/out, password reset, restore of a claude.ai export, writes tagged with the user's id, retries, a second account seeing nothing, new-session restore |

`supabase_sim.py` simulates Supabase's HTTP API, so it proves the app's side only. Row-level security itself must be
checked against the real project (see the main README).

`fixtures/demo-export.json` is an export of the app's built-in **sample data** (Abdullah, Rahim, Nusrat, Ayan), not real records.
Set `CHROMIUM_PATH` to use a specific browser binary.
