# Stitch training-detail checkpoint

November 12, 2026. Local and uncommitted. No push, deployment, migration or hosted
configuration change. Phase 6 and final visual acceptance remain open.

## Controlled comparisons

The [offline report](../../artifacts/stitch-comparison/review.html) now contains
**15 of 60 reference frames; 45 remain pending and none is finally accepted**.
Four training frames were added, and the previous 11 current captures were
refreshed to include the approved consistent workspace shell.

| Frame              | Reference                          | CSS viewport / DPR | Controlled state                                                                                                     |
| ------------------ | ---------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Active workout     | `active_workout_prime_fitness_1`   | 390 × 1298 / 1     | Five frozen slots; first exercise selected, one completed 85 kg × 10 set, next planned row edited to 90 kg × 8.      |
| Exercise selection | `add_exercise_prime_fitness`       | 392 × 1067 / 1.5   | Seven available synthetic exercises, two staged selections, Add exercise sheet open.                                 |
| My Program         | `train_my_program_prime_fitness_2` | 341 × 1600 / 1     | Six-week assignment, four nonempty days per week, first day expanded with five frozen exercises and 17 planned sets. |
| History            | `train_history_prime_fitness_1`    | 395 × 1600 / 1     | Three completed native sessions, latest expanded with three frozen exercise slots and nine logged working sets.      |

The Cairo clock is fixed at November 12, 2026, 10:00 UTC. Accounts, programs,
sets and history are synthetic. No real member data or reference-model media is
captured. Media placeholders intentionally disclose the fixture's missing approved
assets. Source and fixture counts/targets are not asserted to match.

### Calibration and baselines

The picker export is 588 × 1600 pixels, but its HTML and PNG give two independent
1.5× anchors: 56 CSS-pixel (`w-14`) thumbnails appear about 84 pixels wide, and
24 CSS-pixel (`px-margin`) list insets appear 36 pixels wide. Capture it at
392 × 1067 CSS pixels / 1.5 DPR, rather than treating 588 as the CSS width. The
browser produces a 588 × 1601 PNG because CSS viewports have integer heights.
This single-pixel height difference is retained and explicitly allowed for this
case only; images are not rescaled. All other cases require exact dimensions.

`training-baseline/` retains pre-edit active/program/history captures. The initial
picker baseline used the incorrect native-width assumption and remains diagnostic
evidence only. Its report baseline is `picker-calibration-baseline/`, recaptured
after the layout refinement at the corrected viewport. **The picker report is
a reference comparison, not evidence of a before/after improvement.**

Reproduce with the production server at `127.0.0.1:3173`, then run the controlled
capture with `PW_EXTERNAL_SERVER=1`, `PW_STITCH_COMPARE=1`, `PW_STITCH_STAGE=after`.
`PW_STITCH_KEYS` optionally limits captures to comma-separated case keys. To
prepare a future checkpoint, use a separate supported baseline stage and preserve
existing files. Run `node scripts/review-stitch.mjs` after capturing all cases.
The generated self-contained HTML provides originals, baselines, current images
and adjustable overlays. It is ignored local evidence, not a published page.

## Corrections from the comparison

- **Active workout:** removed the duplicate shell header. One compact 64px row
  now contains Back to Train, the brand and notifications, followed by the sticky
  session controls. The existing query-backed overview/resume behavior is retained;
  no session is discarded or recreated by navigation.
- **Exercise picker:** uses 90% of the dynamic viewport with room allocated to
  scrollable results and the staged selection action. The title reserves space
  for the close control. Other consumers of ExerciseDiscovery keep natural flow.
  Selection, filtering, atomic insert and storage-error retry owners are unchanged.
- **My Program:** targets sit below the frozen exercise name rather than squeezing
  it between a thumbnail and a third column. Names retain independent text elements
  for review and tests. Compact English week labels keep full accessible names;
  Arabic retains localized labels. Browsing a week does not imply completion.
- **History:** logged sets use compact paired tiles from 360px upward; narrower
  screens retain one column. Full roles, sides, load conventions, duration, RPE,
  drop-group labels, source data and private guidance remain available.

Comments explain these presentation decisions. No schema, authorization policy,
reward, workout calculation, persistent format or synchronization identity changed.

## Remaining source differences

The approved workspace navigation supersedes the source's variable shell. Active
workout still uses the real load-convention/prescription hints, completed-set edit
actions and optional effort controls. Its selected exercise index, timer and
exercise counts differ from the mockup. No previous weight, coach note, secondary
muscle taxonomy, locked future performance or demonstration asset is invented.

The picker retains logging-mode filters and review-before-insert behavior. It
does not expose shared-catalogue creation to ordinary members. Reference photos,
previous-performance decorations and exact content density remain unmatched.

Program browsing displays the actual frozen sessions, not fabricated completion
colors, estimated durations, deloads, rest/cardio days or coaching doctrine. History
keeps Cairo dates, server-backed paging and repeat recovery; monthly aggregate
cards, PR badges and a workout-card export remain separate unimplemented source
features. Existing personal/achievement export features are not equivalent to that
mockup action. These gaps prevent a final 1:1 acceptance claim.

## Verification

Seventeen distinct Chrome scenarios and seven Windows WebKit scenarios passed,
plus the opt-in capture run. The Chrome regression matrix includes 480 route-size
checks across 30 routes, eight sizes and both languages. Twenty-three focused
unit tests passed for draft editing, atomic exercise selection and Train query
validation. TypeScript, targeted lint and the Node production build passed.
Pages build/output verification passed for 20 static routes and 199 public files.

New browser cases check one compact focus header and reachable picker actions at
320 × 600, 390 × 844, 588 × 1600 and 1280 × 900 in English/Arabic. Existing checks
cover offline refresh, weight drafts, draft-preserving hub navigation, program-week
navigation, frozen labels, complete history sets, Cairo filters/Back, atomic staged
selection with storage failure/retry, and full-catalogue exercise-options response.
WebKit excludes service-worker installation tests; offline/PWA checks remain in
Chrome, with physical-device verification still required.

Initial diagnostics found a capture locator scoped to the wrong element, independent
program-name elements lost during layout editing, an incorrect picker scale and
fractional-DPR raster-height rounding. Corrected locators, restored name spans,
recalibrated screenshots and the explicit one-pixel exception retain the original
behavioral assertions. No persistence or authorization assertion was removed.
The picker baseline limitation is documented above.

Evidence: `artifacts/stitch-training-{baseline,capture,browser,final,webkit,unit,
types,lint,build,pages,review}.log` and `artifacts/stitch-picker-*.log`. Browser data
is mocked; this is not a fresh hosted RLS or physical Safari/Android certification.

Next comparisons: advanced sets, exercise guidance, workout completion/dialogs,
cardio/HIIT, then remaining community/staff/onboarding/system-state exports.
Physical PWA, screen-reader, final fidelity and pilot gates remain open.
