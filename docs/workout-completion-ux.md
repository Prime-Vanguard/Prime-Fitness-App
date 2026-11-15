# Workout completion and HIIT controls

November 12, 2026. Local implementation only. No commit, push, deployment,
database migration or hosted change.

## Delivered

Train now shows the last completed workout summary after server acceptance:
session title, Cairo completion date, elapsed duration, exercised slots, working
set count, external-load volume and recorded hold seconds. Cards reuse the
completion reference's hierarchy with the app's existing tokens. A direct link
opens that session in History; a separate Rewards link shows the existing
confirmed XP/PV view. Dismissal survives refresh. Starting another workout
replaces the previous summary as part of the existing start operation.

No PR, heart-rate, XP gain or rank transition is invented. The summary is a
completion snapshot, not a live authority after later history edits. Dedicated
workout proof-card export and contextual confirmed PR/reward details remain open.

For running/restored HIIT, pause/resume and completion controls appear immediately
after the clock, before read-only configuration and activity summaries. Starting
or restoring reveals those controls; ordinary ticks and pause/resume do not
repeatedly scroll the page. Pre-start configuration keeps its existing layout.
Timer timestamps, pause accounting, completion IDs and sync remain unchanged.

## Ownership and compatibility

- `src/lib/workout-completion.ts` derives display metrics with existing set
  calculations. Warm-ups are excluded from external volume; drop segments count
  toward volume, not working-set count. Timed work contributes seconds. Deleted
  rows are excluded and unilateral working rows count half a set.
- `src/lib/workout-sync.ts` retains the small receipt and clears the draft in
  the same project/member-scoped IndexedDB transaction, only after the existing
  server finish acknowledgement or reconciliation of a lost acknowledgement.
  Pending/rejected completion keeps its existing draft, recovery and export UI.
- `src/lib/workout-store.ts` has an optional version-2 receipt. Existing drafts
  need no IndexedDB/schema migration. It is device-only presentation metadata;
  backup conversion may omit it, while canonical completed history stays on the
  server. It is never sent as reward/progression evidence or cached by the SW.
- `src/features/workouts/workout-complete.tsx` owns presentation only. Train hides
  the snapshot while another session is active or the account does not match.
- `src/features/cardio/hiit-timer.tsx` owns the running-control placement; durable
  timer operations remain in the existing store.

Code comments explain these boundaries. Supabase update/selection conventions
were checked against current official documentation; no API write was added.

## Verification

- **7 Chrome scenarios:** English/Arabic summary, history deep link, refresh,
  dismissal, 320/390/1280-width containment; failed local finish and retry;
  offline finish/reload followed by acceptance; existing lost set response;
  English/Arabic HIIT configuration, failure, paused recovery and completion;
  steady-state offline logging and stable identity.
- **2 Windows WebKit scenarios:** English/Arabic guidance, finish failure/retry,
  summary, refresh, navigation and dismissal.
- **57 unit tests across 8 files:** completion metrics and invalid states, sync
  rejection/lost acknowledgement, draft storage/editor/upgrade, backup
  compatibility, and cardio model/storage.
- TypeScript, targeted ESLint, Node production build and Pages build passed.
  Pages checked 20 static routes and 198 public files.

Evidence is in `artifacts/completion-browser-final.log`, `completion-webkit.log`,
`completion-unit-final.log`, `completion-build.log`, `completion-pages.log` and
`completion-lint.log`. Synthetic screenshots include `workout-complete-en.png`,
`workout-complete-ar.png` and `stitch-hiit-paused-{en,ar}.png`.

These tests use isolated/mocked APIs, not production accounts. Physical PWA,
keyboard, screen-reader and background-device sound checks remain unverified.

## Comparison status and next tasks

Inspected the workout-complete and cardio/HIIT references qualitatively; this
checkpoint adds no controlled matched-frame comparison. Coverage remains
**15/60 compared, 45 pending, none finally accepted**. Unsupported mockup facts
are explicitly omitted rather than filled with synthetic member-facing claims.

Next: calibrated comparison frames for completion and cardio states, then the
onboarding references and physical-device/accessibility checks. Review real
members' start/log/finish task timings before claiming usability gains.
