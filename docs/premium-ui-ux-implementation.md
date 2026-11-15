# Exercise Studio: local implementation

## Water Undo CI recovery — November 15

The first post-merge `main` CI run exposed a race in the offline water Undo
browser test: it reloaded immediately after a click that starts an asynchronous
IndexedDB deletion, before the persisted Undo action appeared. The test now
waits for the visible Undo action before both offline and online reloads, retaining
its identity, revision, synchronization and recovery assertions. The failure
snapshot showed the entry still present without the Undo record after reload.
The corrected scenario passed ten consecutive local Chromium runs. This is a
test synchronization fix; the application persistence contract is unchanged.
The GitHub Actions run must pass again before Pages can publish the merged work.

## Repository publication authorization — November 15

The user approved committing and pushing the accumulated local work after the
pre-commit verification report. Delivery targets the current `feat/sentry` branch.
Expanded `.gitignore` coverage for private QA credentials, auth-state caches,
signing material, rebuildable caches and raw hosted metadata captures; retained
source assets/licenses, tests, migrations and written evidence. Candidate and
staged file reviews check for private paths and common credential formats without
printing credential values. Operational and visual acceptance gaps in the report
remain separate from repository publication.

## Hosted migrations and pre-commit verification — November 15

With explicit authorization, applied production-access hardening and onboarding
preferences to the hosted Supabase project. All 42 migrations are now recorded;
the two new hosted SQL bodies match local versions, and the identity map includes
their deployment timestamps. Frontend changes remain local, uncommitted and
unpushed. The [verification report](readiness/2026-11-15-precommit-verification.md)
records the full checks and separates automated passes, hosted smoke evidence,
advisor notices and physical/visual acceptance still required.

Completed 449 unit tests, the full database suite, 720 permission/performance
comparisons, both production builds, six Pages browser cases, 22 selected
Firefox/WebKit cases, the sync benchmark and 18 hosted smoke checks. Full
Chromium verified 185 cases initially; four obsolete navigation/format assertions
were corrected and passed the focused rerun, covering 189 functional scenarios.
Two opt-in cases were skipped; the sync benchmark was separately executed.
No app behavior changed during these test corrections. Seven lint warnings,
disabled leaked-password protection and six provider-owned default grants remain
documented. No commit, push or frontend deployment was performed.

## Full supported onboarding flow — November 15

Supersedes the earlier units-only checkpoint below. Goals, experience, weekly
days and equipment now have typed inputs, client/database validation, atomic
completion receipts, member/authorized-coach summaries and backup compatibility.
The complete journey includes access, Welcome/language, profile, training,
review/consent, ready/program status and optional apps/device information.
Cross-app linking and push remain explicitly unavailable; no fake integrations
or generated training prescriptions were added. See [onboarding.md](onboarding.md)
for behavior, release requirements and the verification record.

Verified 43 focused unit tests, 19 onboarding database assertions, 42 reliability
and 49 security assertions, nine onboarding browser scenarios and a broader
24-case selected auth/member regression run. TypeScript, targeted lint, Node and
Pages builds passed. Both migration histories replay identically across five
inventories. Synthetic Arabic ready-state capture was visually inspected.
These are local checks: nothing was committed, pushed or deployed. Hosted schema,
physical PWA/screen-reader review and calibrated Stitch acceptance remain open;
controlled comparison coverage stays 17/60. Next: local member testing, then the
remaining calibrated comparisons and release checks.

## Training-preference presentation — November 15

Extracted the supported training-preference screen into its own component with
large unit cards, a live display-conversion example, coach-program guidance and
a keyboard-accessible RPE explanation. It uses existing unit calculations and
the same saved units field; prescribed targets/progression authority are unchanged.
The Stitch training reference was inspected, but its goal, experience, frequency
and equipment inputs have no current setup persistence contract and remain open
feature work. No unsaved fake selectors were added. Seven focused onboarding
Chromium scenarios reported passing, including EN/AR, four widths, unit preview,
retained choices, keyboard disclosure, install states and uncertain-save recovery.
The bilingual capture cases passed again after waiting for the decorative marker
to settle following viewport changes. TypeScript, targeted lint and Node build
passed. Pages build verified 20 routes and 202 public output files.
Physical devices, screen readers and exact calibrated acceptance remain
open; the 17/60 comparison count is unchanged. Next: consolidate onboarding
reference gaps and complete calibrated comparisons for supported states.

## Onboarding device options and ready state — November 15

Added an optional App & notifications screen after confirmed setup, with the
reference's notification/install panel composition. It describes the actual
in-app inbox and explicitly identifies unavailable background push/reminders.
No browser permission is requested or made a condition of completion.
Shared installation UI is used here and in Profile, with manual instructions,
pending prompt, dismissed/error/requested outcomes and confirmed appinstalled
state. Accepting a prompt does not falsely claim installation succeeded.
The ready screen now groups saved identity/units and real program availability
into panels with a shield motif and primary Today action. Retry and absent-program
states remain available. Navigation focuses the screen heading on entry/return.
All 18 selected mobile Chromium authentication/onboarding scenarios reported
passing, including EN/AR, four widths, keyboard/radios, reduced motion, install
outcomes, focus and lost-save recovery. TypeScript, targeted lint and Node build
passed. Pages build passed with 20 routes and 201 scanned public files.
Synthetic device/ready captures were inspected. Physical PWA, assistive
technology and final calibrated Stitch acceptance remain open; coverage stays
17/60. Next: finish the supported training-preference reference and remaining
onboarding comparisons; system-linking needs a separately implemented integration.

## Onboarding access and invitation presentation — November 15

Sign-in, invitation activation, confirmation and reset-request modes now use the
compact onboarding shell. Credential inputs are grouped in a panel; contextual
access guidance has a distinct icon/title and the gold primary action sits below
the form panel. Existing password, invitation, resend, recovery and redirect
operations remain unchanged; language switching is disabled while a request is
pending. No unsupported passkey, OTP or token-verification claims were added.
All 11 authentication mobile Chromium scenarios reported passing, including two
new EN/AR reference-layout cases across 320/393/768/1280px, focus, reduced motion
and retained LTR email input. Synthetic sign-in and Arabic invitation captures
were inspected. TypeScript, targeted lint and Node build passed. Pages build also
passed, verifying 20 routes and 199 public output files. Full calibrated
Stitch parity, physical-device and screen-reader acceptance remain open.
Next: notification/install and ready-state references, then the remaining
supported training-preference presentation. System linking needs a separately
supported integration before it can be presented as functional. Local changes only.

## Onboarding screens: first Stitch implementation — November 15

Added a dedicated language welcome screen and compact onboarding shell for the
existing profile, units, consent and completion flow. Applied reference emblem/
wordmark composition, language cards, panel hierarchy, large headings and full-width
phone actions. Back-to-welcome retains local choices; completed members bypass
the introduction. Save/retry identity and actual program availability are retained.
Five focused mobile Chromium scenarios reported passing; TypeScript, targeted
lint and Node build passed. English/Arabic, keyboard, reduced motion and four
widths are covered; physical-device, screen-reader and final visual acceptance
remain open. See the [onboarding review](design-reviews/stitch-onboarding-inventory.md).
Next: invitation/sign-in presentation and the remaining onboarding references,
mapping controls to supported behavior before adding them. All changes remain local.

Current checkpoint (November 12): Phase 6 controlled Stitch comparison is in
progress, including training-detail comparisons, approved workspace navigation
consistency, focused exercise discovery and completion/cardio comparisons. Seventeen of 60 reference exports have comparison evidence; no screen is
visually accepted. See the [comparison review](design-reviews/stitch-comparison-review.md)
and [offline report](../artifacts/stitch-comparison/review.html). Remaining phases
and device/accessibility gates are not complete.

November 10, 2026. Local work only. No commit, push, deployment, hosted migration
or rollout change is authorized for this implementation.

## Completion/cardio matched-frame comparison — November 12

Added two calibrated frames: completion at 387×1422 CSS / 1.125 DPR and cardio at
372×1067 CSS / 1.5 DPR, retaining the one-pixel cardio-height exception. The report
now contains **17/60 references, 43 pending, none finally accepted**. Baselines for
these frames begin after the previous feature implementation and remain intact.

Fixed a comparison-discovered bug: a program-origin finish now displays its
accepted summary on My Program as well as Workout, preserving the selected tab.
Removed the summary's extra outer card, strengthened metric typography, added a
keyboard-accessible calculation disclosure, and shortened the Cardio eyebrow to
avoid a wrapped title block. Comments explain the changed presentation behavior.

Seven Chrome scenarios (including the two-frame capture) and three Windows WebKit
scenarios passed. TypeScript, targeted lint, formatting and Node/Pages production
builds passed; Pages verified 20 routes and 198 public files. The comparison
generator verified all 17 frame pairs against their recorded reference dimensions.

See [the comparison checkpoint](design-reviews/stitch-conditioning-completion.md)
for fixtures, verification, source inconsistencies and remaining gaps. Completion
is still a Train panel rather than a dedicated stack screen. Unsupported source
PRs, heart rate, rank changes, interval totals, weekly targets and export features
are not fabricated. Next: onboarding reference audit/comparison and the remaining
member/staff/system states, with physical-device/accessibility gates still open.
No commit, push, deployment, hosted change or schema migration.

## Completion summary and running HIIT controls — November 12

Added a device-persistent summary for the last server-accepted native workout.
It shows actual duration, exercise slots, working-set count, external volume and
timed work, with direct History and existing Rewards links. The receipt and draft
clear share one transaction, including lost-acknowledgement reconciliation.
Pending/offline finishes retain recovery UI and never claim server acceptance.
No schema migration, XP calculation, invented PR or new reward write was added.
Running/restored HIIT controls now precede read-only configuration and are
revealed once, preserving timestamp-based timing and stable completion IDs.

Seven Chrome scenarios, two Windows WebKit scenarios and 57 unit tests passed,
including offline completion, failed saves, refresh/dismissal, history links,
draft upgrades, backup compatibility and EN/AR HIIT recovery. TypeScript,
targeted lint and Node/Pages builds passed (20 routes, 198 public files).
See [the completion checkpoint](workout-completion-ux.md) for contracts, evidence
and limitations. Comments document the new modules and storage boundary.

Controlled comparison remains 15/60, 45 pending, none finally accepted. Next:
matched-frame completion/cardio comparison, onboarding and physical-device/
accessibility gates. Contextual verified PR/reward details and dedicated workout
proof-card export remain open. No commit, push, deployment or hosted change.

## Workout guidance and review checkpoint — November 12

Additional-set RPE now clearly means actual effort, with a second tap to clear
the selected optional value. Guidance has a fixed title, scrollable instructions,
labeled execution cues/mistakes, explicit alternatives loading/offline/error/empty
states and retry, and a reachable return/select footer. Finish/discard review has
a fixed title and action footer, clearer per-exercise counts, visible save errors
and guarded dismissal while a durable command is pending. Discard remains outside
notes and retains confirmation and backup export. Code comments explain these
boundaries; frozen targets, draft IDs, sync ordering and server rewards are unchanged.

Eight Chrome scenarios, two Windows WebKit scenarios and 30 unit tests passed.
TypeScript, targeted lint and Node/Pages production builds passed; Pages verified
20 routes and 198 public files. Checks include 320×420 English/Arabic layouts,
alternatives failure/retry, failed local finish and successful retry without
duplicate sets, RPE clearing, offline drafts and lost-acknowledgement completion.
See [the detailed checkpoint](workout-guidance-review-ux.md).

Reviewed the advanced-set, deep-dive and completion references qualitatively.
The finish confirmation remains distinct from a post-save completion screen;
unsupported PRs, heart-rate values and rank transitions are not fabricated.
Controlled comparison coverage remains 15/60, 45 pending, none finally accepted.
Next: the post-save summary with confirmed data, cardio/HIIT comparisons and
physical-device/accessibility checks. No commit, push, deployment or migration.

## Focused exercise picker checkpoint — November 12

Implemented the approved discoverability improvements. The picker opens with up
to eight current-workout/recent/favorite/curated choices, with animated Suggested,
Recent, Favorites and All views. All/search initially show 12 results; bilingual
name/alias search spans the catalogue regardless of the selected shortcut.
Muscle tiles, equipment chips, explicit active filters and secondary mode filters
replace a large initial list. Search/view controls and the reviewed Add action
stay outside one scroll area; guidance returns to the previous scroll position.

Stars persist per account/project on this device after IndexedDB commit. Recent
completed performance uses a bounded, permission-guarded existing table read and
seven-day cache, distinct from successful choices on this device. Optional metadata
failure cannot invalidate an accepted workout batch. Existing stable IDs, atomic
insertion, local retry, archived-exercise exclusion and separate cardio remain.
Guidance was extracted from browsing; pure ranking and device storage have separate
modules and tests. Comments document these ownership boundaries.

Twelve Chrome and six Windows WebKit scenarios passed; 18 unit tests, TypeScript,
targeted lint and Node build passed. Pages build/output verification also passed
for 20 routes and 198 public files. The browser checks include English/Arabic,
four viewport sizes, full-catalogue Arabic search, selection across filters,
favorites after refresh/offline reload, guidance scroll recovery, failed writes
and atomic insertion retries. See [the detailed checkpoint](exercise-picker-ux.md)
for limits, evidence and setup boundaries. The comparison report keeps 15/60
coverage, 45 pending and no final acceptance; its picker frame selects All.

Next: advanced sets, exercise guidance, completion/dialog and cardio/HIIT
comparisons. Cross-device favorites, physical PWA and screen-reader acceptance are
not claimed. No migration, commit, push or deployment.

## Approved workspace navigation checkpoint — November 12

Implemented the owner's approved consistency approach. My Fitness and Staff
Workspace now use a shared menu definition, fixed ordering, stable brand/switcher
and utility positions, and the same notifications/Profile order. Phone drawers,
tablet rails and desktop sidebars share those destinations; mobile shortcuts show
the first five destinations in the selected workspace. Long menus scroll without
moving the utility footer. Active destinations retain gold text and borders.

Profile/settings keeps account/project-scoped workspace context through refresh.
Workspace switching respects existing unsaved-editor guards; stored preferences
never grant staff access. Coaches/Pod leaders retain existing member management;
admins retain their full existing destinations. Back to Train now opens a hub
overview with an explicit resume action, preserving the same workout/set IDs and
durable actual values through refresh and history-filter navigation.

See the [workspace checkpoint](design-reviews/workspace-navigation.md). Seventeen
distinct Chrome scenarios and seven Windows WebKit scenarios passed across the
new cases and targeted regressions, including 480 EN/AR route-width checks. Final
active-style reruns passed in both engines. Twelve focused unit tests, TypeScript,
targeted lint, formatting, whitespace and Node/Pages production builds passed.
Pages output checks covered 20 static routes and 200 public files.
Parallel browser runners initially
collided in their trace directory; reruns used separate output folders. A final
server restart initially used the wrong port; correcting the test port restored
passing runs. These tooling failures did not require data or backend changes.

The approved navigation refinement supersedes differing shell compositions in
earlier Stitch screenshots. At that checkpoint coverage was 11/60, 49 pending, none
finally accepted. Next: active-workout, exercise-selection and history/program
comparisons, followed by remaining references and physical-device/accessibility
gates. No commit, push or deployment.

## First slice

The owner's subsequent instruction is to follow the Stitch designs exactly.
The fidelity correction below supersedes the earlier compact-media interpretation;
the first slice is historical implementation context, not the visual acceptance standard.

- Consolidated the theme to the agreed dark Studio palette. Added an explicit
  display-font alias, accessible control boundaries and tonal raised/row surfaces.
  Removed the shared hero gradient, gold glow and default component shadows.
- Self-hosted Inter 400–600, Manrope 600–800 and Tajawal 400/500/700/800 using ten
  Latin/Arabic WOFF2 faces (about 146 KiB). Google Fonts is no longer requested at
  runtime. Unmodified SIL OFL notices accompany the source and public build.
- Added a reusable LTR brand lockup, 88px tablet rail, 240px desktop sidebar,
  constrained content width and keyboard skip link. Existing role-based
  destinations, paused access, query owners and sync components remain intact.
- Restyled section navigation, headers, buttons, inputs, selects, tabs and
  overlays. Shared close controls have translated labels; ordinary dialogs have
  44px close targets and bounded scrolling. Zoom remains available.
- Moved Cardio into its own URL-backed Train/Progress section. Existing search
  values remain accepted, and unavailable flags do not grant new access.
- Added an exercise progress strip, compact workout header, separated read-only
  prescription, completed-set styling, and Radix Log/About/History sections.
  Log content stays mounted when hidden to preserve in-progress input state.
- Planned rows retain the same fieldsets, IDs, input validation and commands but
  use compact weight/reps/effort fields with an accessible completion control.
  Upcoming sets stay readable and operable. Secondary actions follow logging.
- Kept demonstration playback explicit, existing edit/Undo, finish review,
  shared rest settings, and Discard outside notes/recovery.

History currently shows the existing latest compatible completed performance;
this slice adds no full per-exercise history query. About opens the existing
guidance sheet. These boundaries avoid introducing new data flows during the
presentation migration.

## Compatibility

No workout/editor/offline schema versions changed. No authentication, roles,
Supabase policy, reward, training calculation, Cairo date or frozen-program
contract changed. Local-first writes, slot identities, revisions, tombstones,
account isolation and cached evidence remain owned by existing feature modules.

This is the initial local presentation migration, not a staff/member rollout.
The proposed classic/Studio build-time release switch is not implemented yet;
it remains a release gate before any future external rollout. Do not describe the
current local changes as a completed pilot or production release.

## Baseline and review

Baseline source revision: `3e70114`. The existing workout regression screenshot
was retained at `artifacts/studio-before-workout.png`. Studio screenshots cover
English/Arabic shells at 320/768/1280px and compact workouts at 320px. All fixtures
use synthetic records. No credentials or actual member photos are captured.

The first slice shortened the session header and moved secondary actions below
the inputs. Its former requirement to put actual weight above the rest dock at
scroll position zero is superseded by the owner's media-first Stitch direction.
The updated browser gate verifies media precedes the editable table and that
drafts survive tab changes and offline reloads. Human task speed is not measured.

Human task-time baselines, moderated usability, screen-reader review and physical
iOS/Android keyboard/audio acceptance remain pending.

## Verification

- 403 unit tests across 62 files passed.
- Full browser run: 105 passed and the optional sync benchmark skipped. After the
  final header/action-layout refinement, all 15 targeted workout/Studio scenarios
  passed again, including both new English/Arabic tests.
- All six local Pages browser scenarios passed after the final build.
- TypeScript, formatting and Node/Pages production builds passed. Pages scanned
  193 public output files. ESLint reported zero errors and seven existing Fast
  Refresh warnings.
- Screenshots were inspected for the tablet/desktop shell and English/Arabic
  workouts. This first-slice check predates the media-first correction. Tests verify
  draft retention across tabs, no Google Fonts requests, Cardio navigation,
  offline reload, and unchanged accepted weight/reps/RPE.
- Existing browser scenarios keep their semantic assertions and follow the new
  Cardio destination. No database suite rerun was required for these presentation
  changes; mocked browser checks do not replace hosted/physical-device acceptance.

## Local review

Development preview: `http://127.0.0.1:3000/` (HTTP 200 verified). Restart with
`npm run dev -- --host 127.0.0.1` if the dev process is stopped.

Try Train, My Program, a started workout, the exercise Log/About/History tabs,
direct weight editing, Minimize/Resume, and the separate Cardio section. Switch
English/Arabic and resize to phone/tablet/desktop. The current dev server is for
interactive local review; offline recovery was verified against production builds.

HEAD remains `3e70114`; no changes from this local implementation were staged,
committed, pushed or deployed. Test servers were stopped; the dev server remains
running for the owner's review.

## Current phase status

This status supersedes the original first-slice backlog. Detailed evidence follows
chronologically below; earlier test counts are historical snapshots.

| Phase | Local status                                                                             | Open acceptance work                                                            |
| ----- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 0–1   | Shared Studio foundations, references and shell implemented                              | Release variant, full accessibility/visual acceptance and usability baselines   |
| 2     | Train, logging, options, guidance, Cardio/HIIT and switcher implemented                  | Physical keyboard/audio/background behavior and exact visual acceptance         |
| 3     | Today, Nutrition, crop/camera and durable meal-copy enhancements implemented             | Physical camera/PWA and visual acceptance                                       |
| 4     | Progress, Rewards, Community, discovery and six-rank effects implemented                 | Full accessibility and visual acceptance                                        |
| 5     | Local presentation checkpoint implemented                                                | Full reference comparison, accessibility and device acceptance                  |
| 6     | Staff rosters, training, Pods, reviews, shop, analytics, invites and targets checkpoints | Cross-workspace keyboard/role/RTL, exact-reference and full accessibility gates |
| 7     | Not started                                                                              | Physical-device review, release mechanism, pilot and release approval           |

The code-comment pass has covered core flows but is not a completed audit of every
source file. New and edited Phase 5 code must explain non-obvious behavior and
preserve existing permission, identity, consent and recovery contracts.

## Stitch fidelity correction — November 10

Visual authority is the exported screen composition, not a new interpretation of
the brand. Follow the corresponding English/Arabic references, while keeping
actual data and the existing permission, persistence and reward contracts.
Do not copy broken logos, invented exercise records, unavailable metrics, fake
medical claims or nonfunctional controls from generated mockups.

Corrected locally:

- `active_workout_prime_fitness_1/screen.png`: brand/session bars, exercise
  position, title and muscle chips; a large 16:10 static media preview preceding
  Log/Guide/History; separate execution surface; aligned set/previous/load/reps/
  status columns; gold Log Set action outside the execution card; secondary
  exercise tools after logging. Optional RPE has an explicit disclosure. Existing
  timed-hold, editing, Undo, finish review and discard flows remain available.
- `train_workout_prime_fitness_1/screen.png`: three segmented sections
  (Workout/My Program/History), media-led scheduled preview with frozen exercise
  rows and dose targets, a full-width session action, secondary free-workout card
  and separate Cardio & HIIT card. The schedule still uses its existing query,
  cached frozen metadata, occurrence identity and start command.
- `ExerciseHero` reuses approved static posters and opens the existing guidance
  player explicitly. Animations never autoplay. Missing assets show a neutral
  fallback. No unlicensed screenshot illustration is presented as guidance.
- The existing previous-performance query returns one compatible completed set,
  not historical data for every planned row. Row-level Previous stays “—” when
  no matching history is available; the actual available set remains in History.

The remaining Today, Nutrition, Progress, Rewards, Profile and staff screens still
need their corresponding Stitch composition passes. Shared tokens alone do not
constitute completion or pixel-level visual acceptance. Screen-specific asset
availability, live content length and accessible controls also require review.

Fidelity checks use synthetic data and include English/Arabic at 320px, medium/
large shell layouts, offline refresh, the main Log Set action, existing set IDs,
timed holds, swapping, previous values and occurrence-linked starts. Current
verification results:

- 403 unit tests passed across 62 files.
- All 16 targeted browser scenarios passed against the final Node production
  build, including EN/AR fidelity ordering, narrow/desktop alignment, the main
  Log Set action, offline reload and occurrence-linked starts.
- All six local GitHub Pages browser scenarios passed against the final Pages
  build. These are local compatibility tests, not a deployment.
- TypeScript and both production builds passed. ESLint reported zero errors and
  the seven existing Fast Refresh warnings.
- Reviewed the final English/Arabic workout and scheduled-preview screenshots.
  The synthetic fixture lacks exercise media, so fallback rendering was inspected;
  a separate media scenario verifies approved posters and on-demand GIF playback.
- No database changes. No staging, commit, push or deployment. HEAD is unchanged
  at `3e70114`; the development preview remains at `http://127.0.0.1:3000/`.

## Exact-design follow-up and Exercise options freeze

The owner reaffirmed 1:1 reproduction. The plan now requires source-matched
viewport/content comparisons; a screen may not be called visually accepted based
only on its own screenshot or shared palette. Full-app visual parity is pending.

Confirmed freeze cause: the superset option renderer called `supersetCandidates`
again for every catalogue item. That helper itself scanned the accumulated list
for each exercise. Rendering the full catalogue therefore compounded repeated
scans; the earlier two-exercise fixtures did not expose this path.

Fixes:

- Candidate de-duplication uses a Set. Labels, repeated-slot counts and frozen
  exercise names are built in linear passes with indexed lookups. Options are
  memoized from catalogue/slot dependencies rather than unrelated draft state.
- The native picker renders up to 100 matches plus its selected partner. Search
  covers the full catalogue and keeps a selected item visible outside the current
  filter. A 5,000-exercise unit regression counts ID reads to detect repeated scans.
- The hero uses Stitch's three-dot Exercise options button. Advanced controls,
  swapping, instructions and manual sync retry live in its named, scrollable sheet.
  The default workout no longer has a separate action card underneath logging.
- Matched the exported 8px controls / 12px cards, preview/table spacing, tab icons,
  session elapsed clock and exercise position. The running rest dock now uses the
  hourglass, Rest Interval label, countdown and tonal adjustment controls.
- Added a 3,002-exercise browser scenario with 4x Chrome CPU throttling, full-library
  search, selected-option retention, closing/reopening and saved weight recovery.

Existing warm-up/drop/unilateral, calculator, swap, recovery and offline tests
follow the visible sheet controls. Native selects can consume Escape when their
picker is active; nested calculator tests close the outer sheet explicitly.

Final verification:

- 404 unit tests across 62 files passed, including the catalogue complexity check.
- Broad browser run: 105 passed, one optional benchmark skipped. One calculator
  scenario failed during trace teardown because the concurrently started Pages
  run cleared the shared `test-results` directory (`ENOENT` recording trace).
  Its application steps were not the reported failure. Reran it with a separate
  output directory alongside both language/geometry tests and the catalogue test:
  all four passed. Preserve separate output directories for concurrent suites.
- The catalogue scenario measured 453 ms from click to visible options with 3,002
  exercises and 4x Chrome CPU throttling. This is a local simulated-device result,
  not a physical Android measurement. Details: ignored local artifact
  `artifacts/exercise-options-performance.json`.
- At 390 CSS pixels, EN/AR checks assert 16px margins, a 358px preview, 12px
  corners and 16:10 media. Reviewed the updated screenshots. This is geometric
  verification, not a claim that every screen or media asset has full pixel parity.
- Six local Pages browser checks passed; Node and Pages production builds,
  TypeScript and formatting passed. ESLint has zero errors and seven existing
  Fast Refresh warnings.
- Development preview returned HTTP 200 at `http://127.0.0.1:3000/`. Test servers
  stopped; development server retained. HEAD remains `3e70114`. No staging,
  commits, pushes, deployment or hosted changes.

No database schema, reward rules or persistence format changed. Full screenshot
overlay acceptance across the remaining routes and physical-device review remain
pending. Existing real media/content can differ from exported demonstration data;
do not present these checks as complete 1:1 application delivery.

## Phase 2 continuation: program, history and finish checkpoint

References: `train_my_program_prime_fitness_1/2`,
`train_history_prime_fitness_1/2`, `train_workout_prime_fitness_1` and
`workout_dialogs_prime_fitness` under the local Stitch export.

Implemented locally:

- My Program now uses the assignment notice, training-block card, week bars and
  expandable day cards. Actual frozen set/rep targets and exercise media remain
  inside each day. Selected-week highlighting is not presented as completion
  progress; no logged/overdue/current-day status is invented from a program alone.
- Program/History use equal-width underline navigation and the compact Train
  heading shown in those references. Workout retains its segmented navigation.
  The free-session card is secondary and uses the existing start command.
- History has individual bordered session cards, date/title hierarchy and a gold
  outline for the expanded session. Filters start collapsed when no filter is
  active; applied title/date filters remain URL-backed and reopen after refresh.
  Expanded exercise groups use inset navy cards and responsive set tiles.
- The finish checkpoint has the reference's two-by-two metric grid: actual
  elapsed duration, exercises meeting their targets, external-load volume and
  recorded set entries. Volume uses the existing `setMetrics` rules, preserving
  warm-up, timed, per-hand and unilateral conventions. It does not award XP.
  Discard still identifies affected data and keeps its backup/recovery safeguards.
- Added EN/AR program checks for week changes, independent day expansion and
  unchanged frozen targets. Existing large-history checks retain all 1,001 sets;
  the finish flow asserts its recorded 500 kg fixture volume before saving.

No additional query owners, hosted mutations, database migrations or storage
format changes. Existing scheduling permissions still determine which start
actions are available. Coach-provided names, durations, PRs and completion statuses
are not fabricated to fill gaps in the mockups.

Verification:

- 404 unit tests passed. Thirteen targeted browser scenarios passed for the
  program/history/logging/finish slice. After the final heading/navigation sizing,
  all six EN/AR visual/history scenarios passed again. Screenshot review then
  caught the history title being squeezed by the repeat action; it now has a
  full-width row. Both history scenarios passed after that final fix, including
  a width regression assertion on the large imported-session fixture.
- Six Pages browser scenarios passed against the final Pages build, using a
  separate output directory. Node/Pages builds, TypeScript, formatting and diff
  whitespace checks passed. ESLint has zero errors and seven existing Fast Refresh
  warnings.
- Reviewed the English/Arabic program screenshots, expanded history screenshot
  and finish checkpoint. All use synthetic data. These are reference-led visual
  checks, not complete pixel-overlay acceptance of every screen/state.
- No hosted or repository migration changes. Local preview returned HTTP 200 at
  `http://127.0.0.1:3000/`. HEAD remains `3e70114`; nothing staged, committed,
  pushed or deployed.

Phase 2 remains open for the exercise-picker/advanced-set reference pass,
remaining responsive comparisons and physical-device acceptance. These changes
do not complete the full application redesign or authorize a deployment.

## Phase 2 continuation: exercise picker, protocols and guidance

References: `add_exercise_prime_fitness`, `advanced_set_prime_fitness` and
`exercise_deep_dive_prime_fitness` from the local Stitch export.

Implemented locally:

- The workout picker uses the reference's search surface, horizontally scrollable
  muscle/equipment chips, inset exercise cards, Added state, selection summary and
  gold insert action. It supports up to 20 staged exercises, review/removal and
  clearing the selection. Filtering does not discard selected exercises. Only the
  first 60 matching rows render initially; Show More remains available.
- Confirming a selection applies one IndexedDB workout transaction. Stable local
  slot UUIDs are retained through retries, and a failed write retains the selection
  and its error. New `selectExercises` is a pure command guarded against inactive
  workouts, active timed holds, unavailable exercises and changed replacement
  slots. It validates the whole batch before applying it. A swap remains one
  replacement and retains previous logs and frozen slot targets.
- Single-choice discovery in other application flows retains its existing Use
  behavior. Picker selections are transient until Insert; confirmed workout
  inserts remain durable through offline reload. Closing an unconfirmed picker
  does not insert its staged exercises.
- Empty normalized equipment-tag arrays now fall back to the stored equipment
  field in both discovery filtering and filter choices, so legacy rows do not
  become unfindable by equipment. Common classification labels are localized.
- Working, warm-up and drop protocols use selectable native radio cards with
  keyboard navigation and visible focus. Side, root working set, calculator and
  bounded superset search remain available. Continue to set entry opens the
  existing advanced editor; it does not log a set or change prescribed targets.
  The UI explicitly distinguishes additional-set settings from planned working rows.
- Guidance opens in a responsive bottom sheet with media first, translated
  measurement labels and numbered instruction cards. Approved media playback
  remains explicit. Editorial warnings, source attribution, download restrictions
  and coach-approved alternatives remain intact.

Fidelity boundaries:

- Shared exercise creation is not exposed to ordinary members by copying the
  mockup's Create Custom button. Failure/RPE-10 is not introduced as a new server
  set type. Protocol changes remain actual existing working/warm-up/drop values.
- Do not invent the deep-dive mockup's EMG activation percentages, medical cues,
  strength trajectory, PR labels or training records. Existing licensed media and
  actual records must support these presentations.
- The consolidated load/RPE/rest configuration was subsequently delivered in the
  continuation below. Exact viewport/overlay comparisons remain open; this is not
  complete 1:1 acceptance.

Verification:

- 409 unit tests passed across 63 files. New command checks cover atomic batches,
  retries, validation, frozen targets, unkeyed legacy drafts and swapping to an
  exercise that already exists in the session. A legacy collision now gives only
  the replacement a new stable slot, retaining the other exercise and old logs.
- Seventeen targeted browser scenarios passed for picker/protocol/media/logging
  behavior. The broader run had 108 passes, one optional benchmark skipped and
  two failures: the newly exposed legacy-swap collision and an obsolete textbox
  selector for the now-semantic searchbox. Both were corrected. All six focused
  rechecks then passed against the final Node build, including those two cases,
  EN/AR batch retry, storage failure recovery and the XP guide.
- The XP guide test now dismisses its intended Level up dialog before asserting
  the background heading, removing a timing race without changing rewards.
- Node/Pages builds and TypeScript passed. ESLint has zero errors and seven
  existing Fast Refresh warnings. The public Pages output scan checked 194 files.
- Reviewed English/Arabic picker and advanced-protocol screenshots using synthetic
  records. Pending selections survive filtering and failed saves; completed batch
  inserts retain their slot IDs after offline reload. On-demand GIF and attribution
  behavior remain covered by the existing browser checks.

- All six final Pages smoke checks passed, including staged insertion offline under
  the project prefix. Formatting and diff whitespace checks passed.
- Test servers were stopped. The local Vite preview was restarted for owner review
  on `http://127.0.0.1:3000/`. HEAD remains `3e70114`; no staging, commit, push or
  deployment occurred.

No database migrations, backend settings, reward rules or storage format versions
changed. Physical-device and full 1:1 overlay acceptance remain pending.

### Phase 2 continuation: advanced configuration and interaction verification

The advanced-set reference now informs one consolidated configuration sheet:
protocol cards, actual load and repetitions (or seconds), adjustment buttons,
optional RPE presets/custom input and rest presets/custom interval. Exercise
actions and calculators follow the primary configuration. This sheet configures
the additional-set editor; it does not change prescribed targets or log a set.

- Continue waits for the current configuration to be persisted through the
  existing IndexedDB controller before closing. It then reveals the additional-set
  editor, scrolls it into view and focuses its actual weight input. A failed save
  retains the values and sheet, with an error scrolled into view for correction or
  retry. No successful-save indication precedes persistence.
- Rest preferences reuse the existing durable owner. Pending saves disable
  conflicting actions; custom intervals validate as integer 15–600 seconds. Local
  custom edits survive an older preference acknowledgement.
- Protocol, side and drop-root relationships remain validated against the latest
  workout. Completing configuration never consumes a planned working row.
- Short bottom sheets scroll within the dynamic viewport. Screenshot inspection
  exposed native fieldset minimum sizing that clipped controls horizontally;
  explicit minimum-width resets fix this in both directions. Signed adjustment
  values retain left-to-right order inside the Arabic layout.
- New English/Arabic browser scenarios cover 320×420 and 390×844 viewports,
  horizontal overflow, invalid rest input, injected storage failure, retry,
  focus restoration, offline reload and one stable synchronized warm-up set.
  Planned working-row values are checked separately throughout.

Review screenshots use synthetic records only:
`artifacts/stitch-advanced-ready-en.png`,
`artifacts/stitch-advanced-ready-ar.png` and the corresponding
`stitch-advanced-config-*` error-state screenshots. These are local ignored
artifacts, not production assets or proof of full reference parity.

No schema, permission, reward, sync-owner or storage-format changes are required.
Full-screen reference overlays, physical mobile keyboard/PWA checks and the later
redesign phases remain outstanding. Work stays local for owner testing.

Verification for this continuation:

- All 409 unit tests passed (63 files).
- Broad production-browser run: 112 passed, one optional traffic benchmark
  skipped, zero failures. Six Pages smoke checks passed against the Pages build.
- After the final error-scroll refinement, the Node build and TypeScript passed
  again, and both English/Arabic configuration scenarios passed again with
  viewport assertions for validation and persistence errors.
- Formatting and diff whitespace checks passed. ESLint reported zero errors and
  the seven existing Fast Refresh warnings.
- Normal/error screenshots were inspected in both languages; controls no longer
  overflow the sheet. Automated checks cover narrow and short viewport geometry,
  keyboard focus and durable values, not physical-device keyboard behavior.
- Local preview returned HTTP 200 at `http://127.0.0.1:3000/`. HEAD stayed at
  `3e70114`; no staging, commit, push or deployment was performed.

### Train section switcher consistency

Workout, My Program and History now retain the same segmented switcher and page
heading size. Previously the latter two changed to underlined navigation and a
smaller heading, moving the control on selection. Tab widths, touch targets and
selected-state styling now remain stable. Existing URL navigation is preserved.

Two English/Arabic browser scenarios passed at 320, 390 and 1280 px, checking
unchanged switcher geometry, equal widths, one selected item and selection after
refresh. Screenshots were inspected. Production build, TypeScript, targeted
ESLint, formatting and diff whitespace checks passed. Changes remain local.

### Phase 2: Cardio and HIIT presentation

Applied the layout language from `cardio_hiit_prime_fitness` to the actual Cardio
destination. It opens directly instead of hiding its contents in a disclosure.

- The HIIT view now has a segmented circular clock with a real phase/round label,
  next interval, paused state and ready preview. A separate presentation component
  reads the existing timestamp-derived position; it does not own a second timer.
- The interval blueprint shows the actual total duration, rounds, work, rest and
  preparation. Controls use one full-width gold start/pause/resume/save action and
  a secondary confirmed Clear action. Unsaved settings remain editable; the active
  plan remains fixed. Missing/invalid values receive a translated validation message.
- Steady-state logging has activity chips and grouped canonical-unit inputs.
  Switching views retains both forms during the mounted visit. Saved records and
  started timers retain the existing IndexedDB recovery contract; this change does
  not introduce refresh persistence for an unsubmitted configuration form.
- Recorded seven-day metrics and daily minutes replace the mockup's example
  weekly goal. Empty, loading and unavailable summaries are distinct. Pending
  entries, queue counts, cache age, retry/export, history editing/deletion and
  reviewed conflicts remain available. A redundant self-link was removed.
- Editing a history record opens the logging view and focuses its form. Validation
  and storage errors scroll into view. Timing ticks stop when the timer is paused
  or saved; active timing still recovers from stored timestamps after reload.
- Source-reference adaptations are explicit: no invented Zone 2/4/5 classification,
  target heart rate, tactical protocol name, calories, XP or 90-minute weekly goal.
  Activity chips represent supported logged activities; a HIIT interval plan stays
  a HIIT record. No backend schema, sync owner or reward behavior changed.

Local synthetic screenshots: `artifacts/stitch-hiit-ready-en.png` / `-ar.png`,
`stitch-hiit-paused-*` and `stitch-cardio-log-*`. Full reference-overlay acceptance
and physical-device keyboard/audio/background checks remain pending. No staging,
commit, push or deployment is authorized for this local redesign.

Verification: all 409 unit tests passed. Nine focused production-browser scenarios
passed for EN/AR responsive layout, switcher consistency, timer recovery, storage
failure/retry, logging and conflicts. After the final availability/summary wording
changes, all four cardio/HIIT recovery and conflict checks passed again. The Node
and Pages builds, TypeScript, targeted ESLint, formatting and diff checks passed;
all six Pages smoke checks passed. Screenshots were inspected in both languages.
The local Cardio route returned HTTP 200. No hosted migrations or database tests
were needed because the persistence and authorization operations are unchanged.

### Phase 2 visual review: primary Cardio composition

Compared the actual Cardio presentation against the source HTML/PNG. Reordered
the primary flow to clock → four-tile protocol → compact activity summary → gold
action. Preparation remains a smaller accessible setting. The dedicated page has
an accent eyebrow and labeled return action rather than a second Train switcher.

Detailed charts, history, cache notes and recovery tools now use a secondary
History & sync disclosure. Review-needed queue issues stay visible outside it.
Saving a steady-state entry opens history; editing selects and focuses the logging
form while closing history. Filters, records and the active timer remain owned by
their existing state/controllers. Progress retains its full history presentation.

The [visual review register](design-reviews/train-visual-review.md) records source
differences and outstanding acceptance work. A local HTML comparison provides
side-by-side images and an opacity overlay; its images and controls were checked.
The source's original CSS viewport is unknown, so normalized PNG comparison does
not establish 1:1 parity. Source sample timing/medical/goal values are not fabricated
in the application to make the images match.

Verification: all 409 unit tests passed. Nine focused Cardio/switcher/alignment
checks passed after replacing an outdated broad text assertion with a check of the
actual saved history row. Seven further Train/history/finish/draft checks passed
after using the dedicated Cardio return action in the navigation scenario. All six
Pages smoke checks passed. Node/Pages builds, TypeScript and targeted ESLint passed.
English/Arabic captures were refreshed with synthetic data. No database, sync,
storage format, permission or reward changes were made. No commit/push/deployment.

### Train switcher: sliding selection

The Workout / My Program / History switcher now uses one raised selection surface
that slides horizontally in 200 ms. Label positions, equal widths and navigation
remain stable. CSS calculates the position from the selected index; no DOM
measurement, animation loop or new dependency is required. RTL reverses its travel
direction. Reduced-motion preference disables the transition. The option is enabled
only for the Train switcher; other section controls keep their existing behavior.

English/Arabic browser checks passed at 320, 390 and 1280 px, including final slider
alignment, keyboard activation, reload and reduced motion. The reduced-motion
assertion checks that the transition property is disabled, since the existing
global accessibility rule normalizes transition durations to 0.01 ms. Production
build, TypeScript, targeted ESLint, formatting and whitespace checks passed. Local
preview returned HTTP 200. No staging, commit, push or deployment.

### Phase 3: Today, Nutrition and photo entry

The Today dashboard now prioritizes one start/resume session hero, showing the
actual frozen session prescription when available. Fuel actions sit with daily
totals; consistency and quests precede a compact rank section. A separate
disclosure explains XP versus spendable PV points without inventing conversion
rates. Missing totals, targets and quest progress remain explicitly unavailable.

Nutrition now follows the Stitch hub composition: date/week navigation, one gold
Add Food action, a calorie summary, three macro tiles, horizontal hydration and
meal cards with actual totals. The bottom food sheet has meal chips, method pills,
search-result cards and an editable portion multiplier. Existing scanner review,
custom food, favorites, local persistence, undo and sync operations are reused.
Unconfigured targets are labeled rather than filled with sample source values.

Profile photos support gallery or device-camera selection followed by local
square cropping with zoom and horizontal/vertical framing. Confirmation produces
a 512px JPEG and invokes the existing private upload flow. Cancel does not upload;
upload failure retains the crop for retry. Progress photos also expose a separate
camera action. Native camera availability still depends on browser/device support.

The production service worker now precaches Today alongside the existing public
client-only shells. This fixes offline navigation from Nutrition to Today after a
reload. Authenticated responses, private photos and mutations remain uncached.
No database migration, permission, reward or storage-format change was needed.

The [Phase 3 visual review](design-reviews/phase3-visual-review.md) records captures,
intentional data-dependent differences and outstanding physical-device acceptance.
Changes remain local, uncommitted and undeployed.

Verification: all 409 unit tests and 15 photo-privacy assertions passed. The broad
browser run passed 118 cases, skipped the opt-in traffic benchmark, and exposed
two incorrect new photo-fixture assertions (the fixture already held two photos).
Those assertions now check one additional record. All four Phase 3 English/Arabic
cases passed on the final build, including crop pixels, cancel, failed-upload retry,
frozen targets and offline Nutrition-to-Today navigation. All six Pages smoke
checks passed. Node/Pages builds, TypeScript, targeted ESLint, formatting and
whitespace checks passed. Synthetic screenshots were inspected. Physical-device
camera/PWA checks and controlled 1:1 visual acceptance remain pending.

### Phase 4: Progress, Rewards, Community and muscle discovery

Progress follows the Stitch analytics hierarchy with reusable summary tiles,
tonal section navigation, inset strength charts and record rows. Actual completed
session/set counts remain distinct from working-set volume. A single strength
data point explains why no trend line is shown. Body & Wellness has latest-known
measurement tiles with individual dates, absent-value labels and device-change
status; no health classification or inferred body-fat value is introduced.
The front/back diagram and accessible muscle controls remain intact. Missing
volume data is no longer shown as zero. Photo pose controls expose pressed state,
and photo deletion has a 44px target.

Rewards uses one compact rank/XP/PV summary across its sections, preserving the
six actual ranks, authoritative thresholds and private wallet flow. Unavailable
progress cannot appear as maximum level. The detailed XP guide lives in a labeled
disclosure; roadmap previews, share cards and all earning rules remain available.
Badges use compact icon/content rows without dimming readable text. Shop and
Activity use inset cards; confirmation, durable redemption IDs, stock checks and
pending-request recovery are unchanged.

Community has direct links to Pods, friends, challenges and the weekly leaderboard.
These links scroll within the page, preserving unfinished challenge forms. The
Pod view leads with current Pod selection, opted-in scores and shared workout
activity. Loading, failure and empty results are separate states with explicit
retry. Weekly boundaries now refresh through the shared Cairo activity-day hook.
Social sharing, friend requests, blocks and challenge operations retain their
existing permission checks; no private wellness data or extra rewards are added.

The exercise picker offers muscle-specific starting points: actual program/recent
IDs first, then an explicit curated list of basics. Suggestions use already-filtered
results, exclude archived/cardio entries and open guidance before selection. They
are not described as popularity statistics, coach overrides or automatic swaps.
Exact catalogue names that do not match the curated list remain searchable.

No migration, hosted database change, new dependency, storage-format change,
commit, push or deployment was performed. See the
[Phase 4 visual review](design-reviews/phase4-visual-review.md) for source references,
captures and remaining acceptance work.

Verification: all 411 unit tests across 64 files and all 15 photo-privacy assertions
passed. Eight final production-browser scenarios passed, covering EN/AR responsive
layout, curated guidance previews, missing reward/Pod data, opt-in friend discovery,
million-XP thresholds, durable redemption retries and keyboard photo comparison.
Earlier targeted checks also passed for strength load conventions/imported source
sets, measurement draft recovery, URL restoration, offline exercise selection and
full-catalogue Arabic search. All six Pages smoke checks passed. Node/Pages builds,
TypeScript, targeted ESLint, formatting and whitespace checks passed. The local
source-comparison selectors, image loading and opacity control were checked.
Screenshots were inspected; exact visual acceptance, a full accessibility audit
and physical-device testing are still pending. Local preview returned HTTP 200.

### Follow-up improvements to phases 3 and 4

Implemented the approved [Phase 3 and 4 enhancements](phase-3-4-enhancements.md):
compact fallback/wallet layouts, visible recent foods, metric serving inputs,
reviewed durable meal copying, save/date indicators, crop gestures/reset, neutral
dated comparisons, compact strength filters, current-level roadmap navigation,
muscle breakdown, dedicated Community subviews and reward filters. Saved-copy
recovery is covered by backup validation/merge and device-removal guards.

No new schema, dependency or hosted configuration is required. Original permissions,
sync ownership and server rewards remain authoritative. Additional catalogue images
and categories still require approved assets and metadata; physical-device and exact
visual acceptance are not claimed. All changes remain local and uncommitted.

Verification: 418 unit tests, seven isolated meal-copy database assertions, fifteen
photo-privacy assertions, twenty-four targeted browser cases and six Pages smoke
cases passed. TypeScript, targeted ESLint, Node/Pages builds and formatting passed.
Additional touch-emulation checks cover pinch/reset and keyboard current-level
navigation. The final macro-summary RTL refinement has focused EN/AR checks;
physical-device, assistive-technology and exact visual acceptance remain pending.

### Spacing refinement

Added shared flow defaults for previously unspaced page and sheet siblings, open
disclosure content and plain stacked forms. Existing grid/flex layouts and explicit
spacing utilities retain control, so set-entry rows, navigation sliders and fixed
controls are not globally resized. Section/group/control spacing uses 24/16/12px
defaults with logical block margins for RTL.

The muscle-volume card now separates the diagram, breakdown, muscle buttons and
selected-muscle summary. The button group has a 20px top gap and 12px row/column
gaps. Page headers, card heading/description stacks, sheet headers, overlay action
groups, authentication forms and nutrition fields/list entries have more space.
No data flow, calculation, authorization or storage behavior changed. Changes stay
local and uncommitted. Synthetic spacing captures are in
`artifacts/spacing-muscle-volume-en.png` and `-ar.png`.

Verification: 36 targeted browser checks and all six Pages smoke checks passed,
covering English/Arabic layouts, 320/390/1280px spacing, Train/Cardio, Nutrition,
Progress/Rewards, profile preferences, coach views, staff forms, imports, recovery
and onboarding. Node/Pages builds, TypeScript, targeted ESLint, formatting and
whitespace checks passed. No new unit tests or database checks were needed for
this presentation-only change.

### Motion and status-color refinement

Added restrained navigation/control/overlay/disclosure transitions, saved-record
highlights, fuel and selected-muscle transitions, a shorter server-derived level
reveal, and labeled sky/amber/emerald sync states. Inputs and list positions remain
stable. Reduced motion cancels both CSS and programmatic feedback. See
[motion and color refinements](motion-and-color-refinements.md) for scope,
verification boundaries and unchanged data contracts. No commit or push was made.

### Six-rank aura progression

The shared `RankCrest` now adds size-relative effects behind the original artwork:
Recruit has a subtle slate aura; Seeker silver/ice blue; Forged amber/ember;
Guardian emerald/gold; Vanguard sapphire/gold rings and light points; Prime Legend
the strongest gold/cyan bloom, double halo and light points. The effects are static,
pointer-transparent and contained within the existing crest footprint. High-contrast
mode hides decoration. Existing alt labels, asset variants, rank ranges and reward
rules remain unchanged. This applies to Today, Profile, Rewards, the roadmap and
level-up dialog; exported canvas cards continue using their existing renderer.

The synthetic six-rank comparison is `artifacts/six-rank-auras.png`. Browser checks
cover all six styles, unchanged 48px roadmap dimensions, loaded artwork, EN/AR,
320/390/1280px overflow, reduced motion, forced colors and server-confirmed level
celebrations. Production build, TypeScript and targeted lint passed. No dependency,
backend change, commit or push is needed. All four targeted browser scenarios passed;
the Arabic scenario was rerun after correcting encoding in its test selector.

### Phase 5: Profile and supporting flows checkpoint

Reconciled the obsolete first-slice backlog with the implemented Phase 0–4 work.
Before Phase 5 edits, 418 unit tests, TypeScript and 13 targeted prior-phase
production-browser scenarios passed. Existing device, visual and accessibility
acceptance gaps remain explicit; this is not a claim of full release readiness.

Implemented Profile tonal cards/segmented navigation and actual account details,
shared auth/setup composition, real three-step onboarding bars, bilingual root
fallbacks, notification unread hierarchy/Cairo dates, consistent import/backup/
device surfaces and a branded paused-account card. Added code comments around
new provider boundaries and preserved operations. Dirty drafts, sign-out isolation,
consent, read state, restore and conflict behavior retain their existing owners.

Verification: 23 Phase 5 browser scenarios and six Pages smoke scenarios passed;
Node/Pages builds, TypeScript, targeted lint and formatting passed. All three final compact
Profile EN/AR/draft-navigation checks also passed. Details,
references, screenshots and unaccepted gates are in the
[Phase 5 review](design-reviews/phase5-visual-review.md).

This is a local implementation checkpoint. Full supporting-screen source overlays,
physical devices, accessibility review and release mechanism remain open. No
hosted changes, dependencies, storage migrations, commit or push were made.

### Phase 5 continuation: recovery, imports and backup previews

Compared the offline-state Stitch reference with the working conflict view and
added distinct device/server panels without changing conflict decisions. Import
navigation now includes the actual five-step position. Backup record counts use
labeled tiles while keeping ownership, pending-change and provenance warnings.
Comments document the boundary between displayed evidence and server decisions.

Verification: five targeted production-browser scenarios, two backup component
tests, TypeScript, targeted lint, Node production build and whitespace checks
passed. Arabic conflict screenshots were inspected at 320px. Full visual overlays,
physical-device and accessibility acceptance remain open. No commit, push,
deployment, backend or storage-format change was made.

### Phase 6: staff navigation and roster checkpoint

Grouped existing admin destinations into People, Training, Rewards & reviews and
Analytics. Added full-roster total/active/filter summaries to the admin member
page and a grouped filter surface to the coach roster. Added comments around
permission boundaries and complete-count semantics. No new queries or mutations
were introduced; all reviewed actions retain their existing guards.

Build, TypeScript, targeted lint/format and six staff/account browser scenarios
passed. The final roster layout check covers 320px/1280px overflow. See the
[Phase 6 review](design-reviews/phase6-staff-review.md) for evidence and limits.

Next: desktop roster overview with contextual reviewed editing, member-detail and
mobile summaries, then staff training editors, Pods, queues, shop and analytics.
Phase 5 and earlier visual/accessibility/device gates remain open. Nothing was
committed, pushed or deployed.

### Phase 6 continuation: roster overview and contextual member editor

Separated read-only desktop table/mobile cards from access, role and coach editing.
Both open the existing responsive editor drawer. Confirmations keep the original
review callbacks, stale-write guards and retry behavior. The editor closes during
review and reopens with confirmed values afterward. Added comments around the
overview/edit boundary. Fixed mobile success toasts covering header navigation.

Five final targeted browser scenarios plus two EN/AR member-control alignment
scenarios passed. Node build, TypeScript, targeted lint and formatting passed.
Reviewed the settled EN/AR drawer captures. The [Phase 6 review](design-reviews/phase6-staff-review.md)
records verification details and remaining acceptance gates.

Next: member-detail composition and coach/pod-leader mobile summaries, then program,
exercise, Pod, review queue, shop and analytics workspaces. All changes remain local
and uncommitted; no backend or storage contract changed.

### Phase 6 continuation: member overview and mobile roster summaries

Added an authorized-member header, segmented navigation and an overview linking
the existing record sections beside the seven-day completion summary. Private
reads remain deferred. Mobile coach/pod-leader cards reuse the desktop table's
visible-page summary queries. Pod-only relationships expose no private-detail
link. Code comments explain scope and query reuse. Arabic rank/missing-value
presentation was corrected during screenshot review.

Six targeted browser scenarios and a focused overview-link rerun passed before
the final text refinement. Final mobile captures are checked separately. Node/Pages
builds, TypeScript and targeted lint passed. Details and open gates are in the
[Phase 6 review](design-reviews/phase6-staff-review.md).

Next: program and exercise editor presentation, then Pods, review queues, shop and
analytics. Exact-reference, accessibility and physical-device acceptance remain
open. No commit, push, deployment or backend/storage-contract change was made.

Final refinement: both EN/AR mobile summary capture checks passed, and the Node
production build and targeted lint passed again.

### Phase 6 continuation: program and exercise presentation

Added Training workspace headings, loaded-record summary tiles and grouped search
surfaces. Program builder and exercise editor use segmented section navigation;
the selected draft session shows exercise/prescribed-set totals with inset rows.
Added comments explaining unavailable counts, editorial status and draft ownership.
Existing review, publication, assignment and media permission workflows remain.

Five targeted browser scenarios passed, including EN/AR responsive staff controls,
delayed-read totals, row-draft retention, stale-review rejection, publication and
assignment retries and structured exercise/media edits. Node/Pages builds,
TypeScript, targeted lint/format and whitespace checks passed. Reviewed the Arabic
program capture. See [Phase 6 review](design-reviews/phase6-staff-review.md).

Next: Pod management presentation and review queues, followed by shop and analytics.
Exact reference, accessibility and device acceptance remain open. All changes stay
local and uncommitted; no database/storage/API contract changed.

### Phase 6 continuation: Pods and PV review queue

Added community/review workspace headings, complete-read Pod summary tiles,
status-scoped claim totals, grouped filters, responsive claim cards and full-width
record actions. Leadership, submitted evidence and saved feedback have distinct
navy inset surfaces. Segmented PV navigation preserves the existing task/queue
separation. Comments document data scope and reviewed-write boundaries.

Eight targeted browser scenarios passed across the initial run and corrected
fixture assertion rerun: EN/AR filter alignment, complete Pod counts, stable
creation requests, stale changes, retained drafts, queue search, approval retry
receipts and task management. The new assertion verifies 1,006 status-scoped
claims remain the total after narrowing search to one record. Node/Pages builds,
TypeScript, targeted lint, formatting and whitespace checks passed. Inspected
synthetic Pod mobile and Arabic roster captures.

Next: shop/redemption and analytics presentation. Exact Stitch parity, full
accessibility and physical-device gates remain open. No new queries, backend,
storage or reward contract changes; all changes remain local and uncommitted.

### Phase 6 continuation: shop, redemptions and analytics

Added the Rewards workspace heading, segmented catalogue/queue navigation,
complete-read catalogue and selected-status request counts, grouped controls,
clearer price/stock/status surfaces and a distinct original-charge summary in the
review drawer. Desktop uses semantic catalogue/fulfillment tables; phones retain
cards. Both layouts share reviewed actions and the same filtered page, avoiding
separate write paths. No extra reads or schema changes.

Analytics now has an Operations workspace heading, semantic metric definitions,
inset filters and mobile summaries, spaced desktop table cells, explicit workout
period labels and audit-event cards. Organization totals remain independent of
member filters. Audit loading stays opt-in; CSV export still rechecks current
authority and requires a complete snapshot. Added explanatory comments.

Six final browser scenarios passed after the desktop-table addition, covering
EN/AR mobile/desktop controls, safe complete-roster exports, failed refreshes,
deferred audits, URL filters, refund-once retry, stale visibility review and
uncertain creation receipts. New assertions verify search-independent totals,
unavailable totals after read failure, original charged price in the desktop
table, historical-request reopening and cancelled desktop visibility changes.
Node/Pages builds, TypeScript, targeted lint, formatting and whitespace checks
passed. Inspected synthetic mobile/Arabic and desktop shop captures. Evidence:
`artifacts/phase6-shop-analytics-*` and `artifacts/phase6-shop-desktop.png`.

Next: review the remaining invite and nutrition-target staff screens, then perform
the Phase 6 role/keyboard/RTL and Stitch fidelity sweep. Phase 7 physical-device
and pilot acceptance remains pending. Exact one-to-one visual acceptance is not
claimed by this checkpoint. All changes are local; nothing committed, pushed or
deployed.

### Phase 6 continuation: invitations and nutrition targets

Added Access workspace headings, complete-read invitation summaries, grouped
filters and a semantic desktop invitation table alongside mobile cards. Both
layouts share the existing privileged revocation action. The creator explains
14-day signup eligibility and untracked email delivery; no unsupported tier,
token-delivery or Pod assignment controls were introduced. Summary counts use the
existing clock/status rules and remain unavailable on read failure.

Nutrition targets now have a member-selection prompt, inset picker, Energy &
macros and Hydration fieldsets, saved-value hints and separated review actions.
Visited editors remain mounted to retain per-member drafts. Numeric validation,
empty-field semantics, original defaults, review confirmation, stale baselines
and acknowledgement-loss recovery remain unchanged. Comments explain these
presentation and draft boundaries.

Nine browser scenarios passed across the initial run and focused rerun: EN/AR
responsive controls, former-coach/private-read restrictions, account switching,
numeric/Arabic numeral validation, member draft switching/stale targets/lost
acknowledgements, role/access reviews, invitation history/creation/revocation and
fresh privilege checks. The broader account-switch test initially stopped on a
text selector duplicated by responsive roster markup; scoping its initial
assertion to the member heading restored the complete privacy check. Added tests
for search-independent totals, unknown counts on failure, desktop invitation
review and accessible target groups. Node/Pages builds, TypeScript, targeted
lint, formatting and whitespace checks passed.

Reviewed synthetic desktop targets and Arabic invitation captures. Evidence uses
`artifacts/phase6-invites-targets-*`, `artifacts/phase6-targets-desktop.png` and the
existing `admin-invitations-*.png` / `admin-targets-*.png` captures. Full-page
screenshots can include the known fixed-navigation stitching artifact.

Next: the cross-workspace Phase 6 keyboard/role/RTL and controlled Stitch fidelity
sweep, including remaining desktop Pod/review compositions. Full accessibility,
physical devices and pilot acceptance are still pending. No database, storage,
authorization or reward contracts changed. Nothing committed, pushed or deployed.

### Shared switcher motion across the application

Added a reusable, decorative `SelectionIndicator`. Shared member/staff section
bars now animate by default, with a capsule for segmented bars and a sliding
gold line for underline navigation. Radix exercise tabs retain their keyboard
and panel semantics. Measured button bounds replace Train's equal-width-only
offset calculation, supporting translated labels, wrapping, resizing and
scrolling in both directions.

Applied the same surface to food-entry meals/methods, nutrition week dates,
exercise muscle/equipment filters, program weeks, cardio activities, trend
periods, photo poses, muscle inspection, rest presets, RPE and onboarding
language/unit radios. Binary switches retain their thumb animation with a
corrected RTL direction. Native selects, independent multi-select exercise
staging and rank-map nodes retain their existing interaction patterns.

Transitions use 200 ms easing; reduced motion removes movement. Selection/focus,
drafts, persistence and requests stay with the existing handlers. Observers are
scoped and cleaned up; measurements coalesce into one requested frame without
polling or React state updates per animation frame. Comments explain these
boundaries and each flow's ownership.

Eleven targeted browser scenarios passed, followed by successful final EN/AR
reruns extending the shared-control checks to binary thumb containment. Coverage
includes Train geometry across 320/390/1280 widths, shared navigation resizing,
scrolling food-method geometry, keyboard-operated Radix tabs/focus, reduced
motion, EN/AR staff filters, offline Cardio/HIIT recovery, full-catalogue exercise
options responsiveness, nutrition draft retention and onboarding radio focus.
Node/Pages builds, TypeScript, targeted lint, formatting and whitespace checks
passed. Logs: `artifacts/switcher-motion-*`; inspected the Arabic exercise-tab
capture. Physical-device and full accessibility/fidelity acceptance remain open.

Next: resume the Phase 6 cross-workspace keyboard/role/RTL and controlled Stitch
fidelity sweep, including desktop Pod and review compositions. Everything remains
local and uncommitted; no deployment or backend/storage contract change.

### Phase 6 continuation: desktop Pod/review tables and responsive verification

Added desktop Pod and claim tables while retaining phone cards. Both use the
existing reviewed editor actions and the same filtered page. Narrow table panels
contain scrolling and are keyboard focusable. Staff content now uses the planned
1,440 px maximum width. Fixed long unbroken task/name overflow in mobile claim
cards and bounded desktop text wrapping; Pod pagination can wrap.

Verified 480 document-width checks across 30 member/staff routes, eight viewports
from 320 to 1,920 px and both languages. Added 20 drawer geometry checks, keyboard
opening/heading focus and review-draft retention through resizing/closing/reopening.
Nine distinct browser scenarios passed across final runs, including Pod retries,
stale roster changes, incomplete reads, PV review restrictions and reward retry.
Node/Pages builds, TypeScript, targeted lint, formatting and whitespace checks
passed. Comments explain shared actions and responsive boundaries.

Coverage, raw evidence, fixture corrections and remaining gates are in the
[responsive review](design-reviews/phase6-responsive-review.md). This does not claim
every physical device or complete accessibility/1:1 visual acceptance. Next:
cross-browser/accessibility and controlled fidelity checks, then Phase 7 physical
devices/pilot. Everything remains local; no commit, push or deployment.

### Phase 6 continuation: keyboard focus, zoom and cross-browser checks

Fixed confirmed keyboard focus loss when closing a controlled staff sheet without
a Radix Trigger. Shared sheets/dialogs now restore the actual initiating control
while respecting explicit callbacks and ignoring stale/hidden/disabled elements.
Added forward/backward tab-containment and Escape-return checks.

Selection indicators now convert screen rectangles to layout pixels for CSS zoom
and scaled ancestors. Tests cover 150%/200% CSS zoom, RTL, resizing, scrolling,
Home/End focus and reduced motion. Comments explain both shared fixes.

Added an optional Firefox/WebKit Playwright config with locally cached runtimes
and isolated API mocks; the default Chrome/CI and offline/PWA configuration is
unchanged. Final runs passed 12 Chrome, eight Firefox and eight Windows WebKit
scenarios. The route matrices passed 1,440 viewport checks across three engines,
30 routes, eight sizes and both languages. Builds, TypeScript, lint, formatting
and whitespace checks passed.

See [keyboard/browser review](design-reviews/phase6-accessibility-browser-review.md)
for commands, diagnostic-run corrections, evidence and limits. Native zoom,
screen readers, physical Safari/iOS/Android, installed-PWA and controlled 1:1 Stitch
acceptance remain open. Next: controlled visual comparison and the remaining
accessibility/device gates. Everything remains local and uncommitted.

### Phase 6 continuation: controlled Stitch comparisons

Created five reference/baseline/current triptychs with adjustable overlays and a
60-export inventory. Added an opt-in synthetic-data capture and repeatable report
generator. Corrected the Train fixture to show its scheduled five-exercise plan;
the earlier free-session capture is labeled different-state, not a valid visual
before/after. Staff review export scale and equivalent open-editor state remain
unresolved. No numerical parity claim or final visual acceptance.

Corrected staff navigation priority, desktop toolbar, gutters/title scale and
roster heading/metrics/filter composition. Rollout settings follow the roster.
Existing member navigation, reviewed operations and all backend/offline/reward
contracts remain intact. Comments explain the presentation boundaries.

Node/Pages builds, TypeScript and targeted lint passed. Eleven Chrome scenarios
passed, including 480 EN/AR route-width checks and draft/account isolation; the
final corrected capture also passed. Prior cross-browser evidence predates this
staff-shell correction. See the [comparison review](design-reviews/stitch-comparison-review.md)
for calibration, commands, evidence and limits.

Next: close supported Train/Profile composition gaps, compare equivalent staff
editor states, then continue the remaining 55 exports and device/accessibility
gates. All work remains local; no commit, push or deployment.

### Phase 6 continuation: Train/Profile composition and disclosures

Train now combines the scheduled-session heading and actual plan metadata with
its media area. The compact agenda is secondary and expandable; move/start
operations retain the same occurrence and local-draft ownership. The media
summary is an optional shared component slot, preserving other consumers.

Profile has a compact identity card, photo/activity disclosure, expandable
password form, and preference/device overview links. Collapsing a password form
retains its draft and navigation protection. Sign-out error feedback remains
visible outside the collapsed form. Existing camera/gallery/crop, stats, settings
and privacy destinations remain available. Comments explain the boundaries.

Saved the corrected scheduled-program and Profile captures as a separate member
baseline before refreshing the comparison report. The original checkpoint remains
available; the Train visual delta no longer compares two different session
states. See the [comparison continuation](design-reviews/stitch-comparison-review.md#member-refinement-continuation)
for evidence, gaps and reproduction details.

Sixteen Chrome and three Windows WebKit cases passed, including both-language
disclosure drafts, navigation, crop/retry, offline workout/nutrition recovery,
coached agenda/start and 480 responsive route-width checks. Node build, TypeScript
and targeted lint passed. Pages build/output verification passed: 20 static routes
and 200 public files checked. Formatting and whitespace checks passed. No schema,
reward, permission or storage-format change.

Next: equivalent-state open review-editor comparison and export calibration,
then remaining reference states. Five of 60 exports have comparisons; no screen
has final 1:1 acceptance. Physical-device/accessibility gates remain open.
Everything remains local and uncommitted; no push or deployment.

### Phase 6 continuation: desktop review pane and equivalent-state capture

Added a non-modal desktop claim pane beside the queue at 1280 CSS pixels and
above; smaller screens retain the existing focus-trapped sheet. The same claim
controller owns notes, decisions, stale snapshots and retry identity through
claim/workspace switches and resizing. Keyboard focus, close/confirmation behavior
and scroll-into-view are documented in the new presentation component.

Matched the source's 7:5 desktop composition, compact heading/counts, underlined
workspace navigation and grouped claim facts. Sticky row actions keep the queue
usable beside the pane. Approval still requires its existing review/confirmation
and server receipt; no permissions, reward or storage contracts changed.

Captured a calibrated, open-editor baseline before presentation edits. The report
now compares equivalent pending-claim states at inferred 1.2× source scale using
sidebar and toolbar anchors. See the [review-pane checkpoint](design-reviews/stitch-review-pane.md)
for evidence and calibration limits. Exact visual acceptance remains open.

Fourteen Chrome and six Windows WebKit scenarios passed, including 480 responsive
route-width checks and the existing review/retry/permission cases. Admin-review
checks (23 assertions), Node/Pages builds, TypeScript, targeted lint, formatting
and whitespace checks passed. Pages output verification covered 20 static routes
and 200 public files. Next: Today, Nutrition and Progress
controlled comparisons, then the remaining inventory and accessibility/device
gates. Everything remains local; no commit, push or deployment.

### Phase 6 continuation: Today, Nutrition and Progress comparisons

Extended the controlled report from five to eight reference frames with populated
synthetic daily records, fixed Cairo dates and preserved pre-edit baselines.
Eight of 60 references now have comparison evidence; 52 remain pending, with no
screen finally accepted. See the [daily-page checkpoint](design-reviews/stitch-daily-pages.md)
for state, dimensions, reproduction and source/application differences.

Today has a compact greeting, actual rank/date accessory and snapshot muscle
chips. Nutrition places its summary ahead of meal-copy utilities, adds macro
percentages only for complete totals, and improves narrow macro tile wrapping.
Fixed a misleading partial-cache budget: incomplete device records no longer
produce definitive remaining calories or final percentages. Progress scopes its
existing count metrics beside their values, preserving unknown-data states.
Comments explain these boundaries; logging, rewards, frozen history, permissions
and storage formats are unchanged.

Eleven Chrome scenarios passed, including partial cache/date travel, offline
nutrition, reviewed/atomic meal copying, retained drafts and 480 EN/AR responsive
route checks. Final narrow alignment/capture and partial-cache reruns also passed.
Five Windows WebKit scenarios passed for narrow daily layouts, partial budgets
and meal-copy recovery. Node/Pages builds, TypeScript, targeted lint, formatting
and whitespace checks passed. Pages output verification covered 20 static routes
and 200 public files. The compatible WebKit selection
excludes service-worker installation tests; those passed in Chrome.

Next: Strength, Body & wellness and Photos controlled comparisons, then remaining
training/staff/community states. Progress Overview's source trend/PR composition
remains open; physical PWA, screen-reader, final fidelity and pilot gates remain.
Everything stays local and uncommitted; no push or deployment.

### Phase 6 continuation: active workout, exercise selection, program and history

Added four controlled training frames and refreshed the previous 11 current
captures for the approved workspace shell. Coverage is **15 of 60 references,
45 pending, none finally accepted**. See the
[training-detail checkpoint](design-reviews/stitch-training-details.md) for fixtures,
source gaps, calibration and the picker baseline limitation.

The active workout now has one compact header containing Back to Train, brand and
notifications. The exercise sheet allocates 90% of the dynamic viewport to its
controls, scrollable results and staged action. Program targets sit below frozen
names, with independent name elements and compact accessible week controls.
History uses paired set tiles from 360px upward while retaining every logged field.
Comments document presentation ownership; workout IDs, draft storage, calculations,
authorization, synchronization and rewards are unchanged.

Seventeen Chrome scenarios and seven Windows WebKit scenarios passed, including
480 EN/AR route-size checks. Twenty-three unit tests, TypeScript, targeted lint,
Node build and Pages build/output verification passed. Pages verification checked
20 static routes and 199 public files. New tests exercise the header and staged
picker at four viewport sizes; retained tests cover offline drafts, atomic inserts,
storage failure/retry, frozen programs, complete history and Cairo filters.

The picker export is inferred at 1.5 DPR from two HTML/PNG anchors. Its corrected
baseline was captured after layout refinement, so no before/after improvement is
claimed for that frame. Integer viewport rounding creates a disclosed one-pixel
height difference; report validation allows that case only and keeps images intact.
Other frames retain their pre-edit baseline and strict dimensions.

Next: advanced sets, exercise guidance, workout completion/dialogs and cardio/HIIT
comparisons, then remaining community/staff/onboarding/system states. Missing media
and unsupported mockup features remain explicit gaps; physical PWA, screen-reader,
final fidelity and pilot gates remain open. No commit, push or deployment.

### Phase 6 continuation: Strength, Body & wellness and Photos

Added three controlled reference/baseline/current frames using populated synthetic
strength/measurement records and clearly marked test images. Coverage is 11 of
60 references, with 49 pending and no final visual acceptance. See the
[Progress-detail checkpoint](design-reviews/stitch-progress-details.md) for states,
dimensions, source gaps and evidence.

Strength controls now live with the chart in one stable tree, including empty
searches. The latest period estimate is visible; numeric trend data is expandable.
Body has compact measurement cards and phone history cards backed by the same
records/statuses as the retained desktop table. Measurement drafts and write
recovery keep their existing owners.

Photos prioritizes capture/gallery actions and comparison before the two-column
phone archive. Side-by-side and slider views share the authorized pair; secondary
filters are expandable. Fixed the reproduced Arabic slider-coordinate mismatch
while keeping Arabic labels/outer layout RTL. Privacy/signing/deletion and retry
contracts remain intact; no encryption or medical/recovery claim was invented.

Fifteen Chrome and six Windows WebKit scenarios passed, including 480 EN/AR
route-width checks, retained comparison/measurement state, imported strength
evidence, empty-search focus, private-photo paging, errors and deletion retries.
The photo-privacy script passed 15 assertions. Node build, TypeScript, targeted
lint, formatting and whitespace checks passed. Pages build/output verification
passed: 20 static routes and 200 public files checked. Next: active-workout, exercise
selection and history/program comparisons, then the remaining inventory and
accessibility/device gates. Everything remains local; no commit, push or deployment.

### Onboarding reference inventory

Inspected all nine onboarding HTML exports and mapped them to the existing auth
and three-step setup in [the onboarding inventory](design-reviews/stitch-onboarding-inventory.md).
This is a source inventory only: controlled screenshots, visual comparison,
implementation and acceptance remain open. Mockup-only authentication and
cross-product integration must not be represented as existing functionality.

### Workout feedback continuation

Planned sets now announce an in-progress device save without announcing success
before persistence. The rest countdown uses a gold final-ten-seconds cue based on
the actual deadline, including after adjustments; it does not estimate progress
from the configured duration. Existing save, retry and audio behavior is unchanged.
TypeScript, targeted lint, formatting, 42 reliability assertions and the focused
mobile Chrome planned-set/deadline check passed. The offline workout scenario
passed against the earlier build; it was not rerun after this presentation change.
Physical-device, screen-reader and additional RTL/reduced-motion checks remain open.
Next: verify and refine sync-state feedback and shared loading/navigation states.

### Workout sync and progress loading feedback

Workout sync now gives errors precedence over a synced indicator and distinguishes
offline with no pending writes from locally saved pending writes. It does not infer
in-flight activity from connectivity or a pending count. Progress overview uses a
static, accessible four-card loading placeholder instead of rendering unavailable
metrics during its initial load. No synchronization owner or persistence format
changed. Focused sync-state unit tests, TypeScript, targeted lint and Node build
passed; mobile Chrome covered offline workout save/reload and daily layouts in
English and Arabic. The loading placeholder itself still needs a delayed-response
browser check; physical-device and screen-reader acceptance remain open.
Next: expand verified loading states and review shared navigation transitions.

### Progress loading and navigation verification

The Progress placeholder now matches the three-card summary layout, including
the full-width final card on narrow screens. Synthetic delayed-response browser
checks confirm the accessible loading message and placeholders are replaced by
real metrics in English and Arabic at 320px with reduced motion. Shared switcher
tests also passed in both languages for resize, keyboard, RTL and reduced motion.
TypeScript, targeted lint and the Node build passed. Physical-device and assistive
technology checks remain open; no other screen's loading state was changed.
Next: extend the same verified loading pattern to appropriate screens and review
nutrition/progress interaction feedback against real data and offline states.

### Nutrition loading feedback

Nutrition now shows a static calorie/macro placeholder only when totals are
incomplete, a read is in flight and there are no device entries to show. Partial
device records remain visible, and stopped or failed reads retain the unavailable
and retry messages. This changes presentation only; cache and mutation ownership
are unchanged. Six mobile Chrome cases passed across English and Arabic: delayed
loads, partial offline cache, and failed reads followed by retry. Reduced motion
and 320px were exercised in the delayed-load cases. TypeScript, targeted lint and
the Node build passed; physical-device and screen-reader checks remain open.
Next: review Progress and nutrition interaction feedback and remaining loading
states without implying incomplete records are complete.

### Partial nutrition target feedback

Incomplete device totals no longer display calorie or macro progress bars against
full daily targets. Complete totals retain their bars when targets are configured;
actual partial numbers and the unavailable-budget explanation remain visible.
Mobile Chrome checks passed for complete versus partial totals in English and
Arabic and for persisted nutrition feedback with reduced motion. TypeScript,
targeted lint and the Node build passed. Physical-device and screen-reader checks
remain open. Next: review Progress interaction feedback and remaining loading states.

### Muscle-volume recovery

The muscle-volume view now offers retry after a failed read and retains the last
loaded result and selected muscle when a later refresh fails, clearly labeling it
as the last loaded result. Selection controls no longer appear before data loads.
No muscle-volume calculations or permissions changed. English and Arabic mobile
Chrome tests passed for initial failure, retry, failed refresh, retained selection
and recovery; the existing bilingual diagram/photo layout scenario also passed.
TypeScript, targeted lint and the Node build passed. Physical-device and
screen-reader checks remain open. Next: continue the remaining shared loading and
interaction feedback work.

### Measurement history feedback

Body & wellness now shows a static loading placeholder when no measurements are
available during an initial read. Missing values are labeled unavailable until a
successful online history read confirms that they were not recorded; incomplete
device records remain visible. Error text distinguishes whether device entries
are supported, and the empty-history prompt requires a successful read. No
measurement persistence or sync logic changed. Mobile Chromium covered delayed
reads, failure, retry and empty results in English and Arabic at 320px with
reduced motion, plus the existing bilingual measurement and photo flow.
TypeScript, targeted lint and the Node build passed. Physical-device,
screen-reader and dedicated offline-cache browser checks remain open.
Next: continue reviewing loading and recovery feedback on remaining screens.

### Onboarding profile and consent visual review

Inspected the profile and consent references against synthetic mobile captures
in English and Arabic. Setup is now top-aligned on phones, with the existing
consent text and required choice grouped in a clearer panel. Five focused mobile
Chromium scenarios reported passing, including lost-save recovery; TypeScript,
targeted lint and Node production build passed. The web server was manually
stopped after the test results. The screenshots are qualitative rather than
calibrated equivalent-state overlays: the 17/60 controlled comparison count
and final visual acceptance remain unchanged. Physical-device and screen-reader
checks remain open. Details and artifacts are recorded in the
[onboarding inventory](design-reviews/stitch-onboarding-inventory.md).
Next: calibrate supported onboarding states and continue remaining member,
staff and system comparisons without adding unsupported reference claims.
