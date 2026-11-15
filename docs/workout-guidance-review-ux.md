# Workout guidance and review UX checkpoint

November 12, 2026. Local changes only; no commit, push, deployment, hosted change,
schema migration or reward-rule change.

## Changes

- Advanced additional-set controls label RPE as **actual effort**, keeping it
  separate from prescribed targets. Tapping the selected RPE again clears this
  optional evidence. The same durable draft and validation own the values.
- Exercise guidance separates its fixed title, scrollable reading area and
  reachable action footer. Instructions remain numbered; execution cues and
  common mistakes have explicit headings. Loading, offline-unavailable, failure
  with retry, and successful empty alternatives are distinct states.
- Guidance keeps demonstration playback on demand, permission/attribution text,
  editorial warnings, English source access and approved alternatives. Returning
  closes the guidance without changing the exercise or its recorded performance.
- Finish/discard review separates the fixed title and action footer from the
  scrollable summary, adds the session title to finish review, and makes each
  exercise's actual working count easier to scan. Errors remain beside the save
  action. Busy operations cannot dismiss review via Cancel, Escape or backdrop.
- Discard still identifies the session and logged-set count, offers backup export,
  and requires explicit confirmation. The existing visible discard entry stays
  outside session notes. No new promise of automatic recovery is made.

Comments explain the scroll boundaries and durable-operation ownership.

## Stitch alignment and limits

Inspected `advanced_set_prime_fitness`, `exercise_deep_dive_prime_fitness` and
`workout_complete_prime_fitness`. Reuse their dark surfaces, distinct instructional
blocks, numeric emphasis and prominent actions while retaining supported data.
Actual RPE deliberately replaces the mockup's target-effort wording for a form
that logs real performance. No invented muscle activation percentages, coaching
directives, PRs, heart-rate values, rank transitions or XP estimates were added.

The finish **confirmation** is not a post-save workout-complete screen. The
Stitch post-save summary, verified PR presentation and associated export remain a
separate task. This checkpoint does not add controlled reference frames or mark
visual acceptance: the tracker remains **15/60 compared, 45 pending, none finally
accepted**.

## Verification

See `artifacts/workout-polish-*` for local logs and synthetic screenshots.
Eight Chrome scenarios, two Windows WebKit scenarios and 30 unit tests passed.
TypeScript, targeted lint, Node and Pages builds passed; Pages checked 20 static
routes and 198 public files. Final logs are `workout-polish-browser-verified.log`,
`workout-polish-webkit-final.log`, `workout-polish-unit.log`,
`workout-polish-build.log`, `workout-polish-pages.log` and `workout-polish-lint.log`.

Browser coverage includes 320×420 English/Arabic guidance with long instructions,
failed alternatives followed by retry/empty results, reachable footers, RTL and
horizontal containment; finish cancellation, failed IndexedDB commit and retry
without duplicate sets; advanced RPE clearing, local failure/offline recovery;
and the existing lost-acknowledgement workout completion flow.

Physical Android/iPhone installed-PWA, real virtual keyboards and screen-reader
acceptance remain required. Browser emulation does not establish these results.
No additional setup is required.

## Next

Review the post-save completion journey with server-confirmed data, then compare
cardio/HIIT setup, timer and history states. Continue onboarding and the remaining
Stitch references after the training journeys are coherent. Measure task timing
with real members before claiming numerical usability gains.
