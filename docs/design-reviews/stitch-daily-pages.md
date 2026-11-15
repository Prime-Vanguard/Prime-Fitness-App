# Stitch daily pages checkpoint

November 12, 2026. Local work only; no commit, push, deployment, hosted migration
or rollout change. Phase 6 and final 1:1 visual acceptance remain open.

## Controlled comparison coverage

Extended the [offline comparison report](../../artifacts/stitch-comparison/review.html)
from five to eight frames. The catalogue still contains 60 PNG references:
**eight compared, 52 pending, none finally accepted**. Inventory status describes
comparison coverage, not completion of a route or visual approval.

| Frame     | Reference                           | CSS viewport / DPR | State and comparison limits                                                                                                                                                                 |
| --------- | ----------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today     | `today_prime_fitness_1`             | 377 × 1600 / 1     | Five-exercise scheduled program, fixed Cairo date and synthetic food/history. Source photo, previous bests and prescribed duration/volume differ.                                           |
| Nutrition | `nutrition_daily_hub_prime_fitness` | 313 × 1600 / 1     | Three populated meals, 1,550 kcal, 1,750 ml water and fixture targets. Source values and meal contents differ; actual editing/sync/recovery controls are retained.                          |
| Progress  | `progress_prime_fitness_1`          | 363 × 1600 / 1     | Overview with two synthetic completed sessions and no set rows. Source includes trends and PRs within Overview; the application keeps those in Strength. This composition gap remains open. |

Native PNG dimensions are used for these phone references; no raster scale is
inferred. Captures freeze the date at November 12, 2026, 10:00 UTC so activity
dates and cache windows match between stages. Baselines were captured from the
previous built application before presentation edits and retained under
`artifacts/stitch-comparison/daily-baseline/`. Other frames continue using their
own original/member/review baselines. Never overwrite an earlier baseline after
editing and call it a before result.

The capture test accepts `PW_STITCH_STAGE='daily-baseline'` for future baseline
preparation; `after` refreshes the current frames. `review-stitch.mjs` reads the
frame-specific baseline stage, checks output dimensions and creates triptychs,
overlays and the inventory. All identities and records are synthetic. These
comparisons assess layout, not matching the mockup's fictional performance.

## Changes

- Today uses the reference's compact greeting scale and a real rank/level badge
  beside the Cairo date. An optional shared `PageHeader` accessory keeps that
  row responsive without absolute positioning; other headers retain their
  existing spacing. Unknown ranks are not presented as confirmed values.
- The session hero includes muscle chips from frozen plan metadata, matching the
  reference's hierarchy. No duration, training-volume target or previous best is
  invented. The existing Train destination and occurrence-start flow are retained.
- Nutrition places its calorie/macro summary directly after Add Food, moving the
  optional meal-copy operation into the meals section. Copy, preview, stable IDs,
  offline atomic logging and Undo ownership are unchanged.
- Compacted the nutrition-summary heading and added actual macro percentages
  when totals and targets are available. Narrow tiles keep target/unit text
  together and allow large values to wrap without document overflow.
- Corrected a misleading partial-cache state: cached targets plus incomplete
  device records must not produce a definitive remaining budget or percentage.
  Partial records remain visible, with an explicit unavailable-budget message
  until complete totals load. Complete totals still show remaining/over-target
  calories. No food record or reward calculation changed.
- Progress cards now explain completed/imported history, the Cairo week-start
  window and the separate counting of side/drop entries next to their values.
  Removed the detached duplicate footnote. Unavailable counts remain an em dash;
  source volume, adherence, duration and recovery figures are not substituted
  with unrelated counts.

Comments document presentation, frozen metadata, partial-data and scope rules.
No schema, permission, authentication, reward or persistent-storage format changed.

## Verification

Eleven Chrome scenarios passed, including 480 document-width checks across 30
routes/eight viewports/both languages. After final macro-bar alignment, the
eight-frame capture and two partial-cache cases passed again. Five Windows
WebKit scenarios passed for EN/AR narrow daily views, partial-cache budgets and
meal-copy retry recovery. Node/Pages builds, TypeScript, targeted lint, formatting
and whitespace checks passed. Pages output verification covered 20 static routes
and 200 public files.
Browser checks cover the new eight-frame capture, EN/AR
partial-cache behavior at 313 px, daily targets/offline nutrition, meal-copy lost
acknowledgement and offline replay, section/draft navigation, nutrition entry
retention and the 30-route/eight-size responsive matrix in both languages.

The partial-cache scenario advances beyond seven days through the public
date/focus flow, adds an offline entry and verifies that targets stay cached while
the budget remains unavailable. The initial fixture's one-day login expired
during that eight-day jump and correctly returned to sign-in. Only this clock
travel case opts into a 14-day synthetic token; default fixtures and application
authentication are unchanged. Diagnostic logs are retained separately from final
results.

The compatibility configuration intentionally blocks service workers. An initial
WebKit selection included three installed-PWA cases that await
`navigator.serviceWorker.ready`; those waits cannot complete in that setup.
Offline installation/reload checks remain in the successful Chrome run; the final
WebKit selection covers compatible presentation and retry flows. The initial
immediate resize-width assertion was also corrected to wait for the existing
selection marker's next-frame measurement. Final 313 px checks pass in both
languages. No application authentication or service-worker policy was weakened.

Evidence: `artifacts/stitch-daily-{baseline,browser,webkit,build,pages-build,types,lint}.log`.
Final alignment/capture rerun: `artifacts/stitch-daily-final-capture.log`.
Screenshots, overlays and manifests are local ignored artifacts. Browser mocks
do not verify hosted authorization. Windows WebKit is not physical Safari/iOS.

## Remaining gaps and next work

The shared mobile header, content density, typography and optional media still
differ from the exports. Nutrition retains actual sync/delete/edit and copy
controls absent from the source. Today retains shields, quests and XP explanations
instead of fictional ledger/sharing data. Progress Overview still differs
substantially from the source's trend/PR composition; its Strength view must be
compared against `progress_strength_prime_fitness` before reorganizing those
existing flows.

Next: Progress Strength, Body & wellness and Photos comparisons, followed by the
remaining training/staff/community states. Physical PWA, screen-reader, final
visual review and pilot gates remain open.
