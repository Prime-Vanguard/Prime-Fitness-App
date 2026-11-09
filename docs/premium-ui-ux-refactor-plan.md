# Prime Fitness: Stitch-based premium UI/UX refactor

Status: planning; visual direction awaits approval. Updated November 10, 2026.

## Executive overview

Use the Exercise Studio references under
`design/stitch_prime_fitness_tracker_app` to create a calm, premium, exercise-led
experience. Adopt dark-only navy surfaces, restrained gold, clear numerical
controls and compact logging. Preserve the existing application and backend
contracts rather than rebuilding them from generated HTML.

Agreed decisions:

- Dark only, replacing the earlier light-theme proposal.
- Mobile-first member workflows and desktop-first staff workspaces.
- Five member tabs: Today, Train, Nutrition, Progress, Rewards; Profile in the
  header/sidebar.
- Exercise Studio media with collapsible demonstrations and immediately reachable
  editable set rows.
- Subtle rank identity outside Rewards.
- Unsupported mockup functionality belongs to a separate future backlog.
- Discard Workout stays visible outside Session notes & recovery.
- Create/review concepts before beginning the application redesign.

[Noor's first-use feedback](noor-first-use-feedback.md) adds two release-blocking
investigations and five UX work items. Fixing these bugs need not wait for the full
visual rollout; new visual features still follow review gates.

## Evidence and audit

The local export contains 60 PNG references, 59 HTML screens, a main design
specification, Exercise Studio token specification, export summary and brand kit.
All PNGs were inspected through contact sheets; representative workout, staff and
offline screens were inspected larger. Source inspection covered actual routes,
tokens, workout/nutrition modules, recovery, social and staff boundaries. This is
not a fresh interactive audit of every screen or physical-device acceptance.

Source precedence: current user decisions; existing security/persistence/reward
contracts; this plan; main Stitch design.md; screenshots; generated HTML.

| Priority | Evidence                                      | Confirmed issue / action                                                                                                 |
| -------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| P0       | Noor's Android test                           | Use cannot add exercises and scanner is missing; reproduce rather than assuming caching is the cause. See linked report. |
| P1       | src/routes/_authenticated/_shell/train.tsx    | Cardio/recovery precede primary training navigation; reorganize around start/resume.                                     |
| P1       | src/features/workouts/planned-set-rows.tsx    | Separate fieldsets and completion buttons are tall; introduce compact rows without changing drafts/IDs.                  |
| P1       | src/components/workout-session.tsx            | Approximately 636 lines mixing presentation/orchestration; extract around existing controller.                           |
| P1       | src/routes/_authenticated/_shell/progress.tsx | Cardio sits above section navigation; give it a section.                                                                 |
| P1       | src/components/ui/dialog.tsx                  | Enlarge close target and translate accessible label; audit sibling overlays.                                             |
| P1       | src/routes/__root.tsx                         | English-only root error/not-found copy and bespoke controls.                                                             |
| P2       | src/styles.css and route markup               | Repeated card/gold treatments, gradient/shadows and ambiguous font-display usage; consolidate.                           |
| P2       | src/components/member-sections.tsx            | Prominent wrapping section buttons consume space; use quiet section navigation.                                          |
| P2       | Rewards / Social                              | Roughly 740 / 583 lines; extract task presentation and retain mutation owners.                                           |
| P2       | Coach tools / Pod editors / program builder   | Roughly 720 / 618 / 625 lines; extract task boundaries incrementally.                                                    |
| P2       | Root font links                               | Runtime Google Fonts requests; self-host licensed subsets.                                                               |

The root already forces dark mode. Light CSS tokens exist but inspection did not
identify an exposed theme selector; do not invent a preference-removal migration.

Stitch corrections: preserve zoom; remove CDN Tailwind, inline handlers and remote
icon fonts; fix logo references and serif-looking fallback headings; do not copy
fictitious security claims, wearable data or new XP rules. Gunmetal/deep contrast
is approximately 1.41:1 and cannot be the sole identifying input boundary. Do not
apply 65% opacity to upcoming rows or use placeholders as their only prescription.

Hypotheses needing user testing: previous/prescribed/actual comprehension; media
versus logging speed; Arabic section navigation; staff drawer density; and
understanding device-save versus server acceptance.

## Three visual directions

| Direction                          | Composition                                                                                     | Use                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------- |
| Exercise Studio Club (recommended) | Official navy/gold, Manrope/Inter/Tajawal, exercise imagery, quiet surfaces, compact active set | Main application             |
| Precision Studio                   | Same identity, smaller media, dense numbers and aligned tables                                  | Training and staff treatment |
| Vanguard Heritage                  | Existing crests, editorial spacing, milestones and restrained gold rules                        | Journey and achievements     |

These are coordinated treatments, not selectable themes. Keep long-term identity
subtle during daily work. Reuse approved rank emblems and licensed media references.

## Screen specifications and annotated concepts

### Today

Reference: today_prime_fitness_1 and today_prime_fitness_2.

Order: wordmark/notifications/profile; date/greeting; next or active session hero;
exercise list; fuel; consistency; compact rank/quests. A single Start/Resume CTA
uses actual occurrence/frozen prescription data. Do not invent readiness, duration
or tonnage targets. Missing data is unavailable, not zero.

### Train and active workout

References: train_prime_fitness_2, train_workout_prime_fitness_1,
active_workout_prime_fitness_1/2, advanced_set_prime_fitness, workout_dialogs_prime_fitness.

Train sections: Workout, My Program, History, Cardio. Preserve existing search
state/deep links and add validated cardio. Use concise recovery notices opening
the existing project-confirmation/export review.

```text
Minimize         Session / elapsed          Finish
Progress         Saved on device / pending sync
Exercise / muscles / load convention / prescription
Log | About | History       Show demonstration
Set | Previous | Actual weight | Reps | Complete
Log current set             Advanced options
Exercise outline
Session notes & recovery
Discard workout
Rest timer                   -15s / +15s / Skip
```

Log is default. Phone media is compact/collapsible; About holds the larger demo.
Desktop uses logging plus outline/guidance. Preserve focus when media collapses.
Prescription stays visible and read-only; actual weight supports clearing,
decimals and kg/lb. Do not promote placeholders to logged performance. Preserve
existing initialization rules and delayed-evidence protection.

RPE remains reachable in row detail on narrow screens. Completed sets use the
existing original-record edit operation. Row ticks and primary completion share
one guarded command; upcoming rows stay readable and editable. Preserve timed
holds, warm-ups, sides/pairs, drops, supersets, calculators and swapping.

Rest dock reserves layout space; keep preview/volume/mute/vibration controls and
explain browser limits. Finish keeps the existing review and pending-acceptance
state. Discard remains outside notes, names affected data, and retains recovery
export. No custom keypad in the initial release. No claims of PR/XP before
authoritative evidence.

### Exercise guidance/discovery

References: add_exercise_prime_fitness and exercise_deep_dive_prime_fitness.
Reuse search, normalized aliases, equipment/muscle/mode filters, alternatives,
complete catalogue paging and fallback thumbnails. Keep archived history labels,
translation draft warnings, load conventions, attribution and cardio separation.
Do not add shared-exercise creation permissions from mockups. Add coach-curated
muscle recommendations under Noor's backlog; no unmeasured popularity claims or
fabricated activation percentages.

### Nutrition

References: nutrition_daily_hub_prime_fitness and add_food_sheet_prime_fitness.
Date/targets first, Add Food primary, meal groups and water. Reuse existing entry
sheet for search/favorites/custom/quick macros/scanning; mandatory scan review.
Preserve serving validation, drafts, undo, pending totals and atomic favorites.
No invented coach-verified labels. Camera/network/product failures retain manual
alternatives. Scanner rollout failures must be distinguishable from disabled
availability.

### Progress

References: progress_prime_fitness_1/2, progress_strength_prime_fitness,
progress_body_wellness_prime_fitness and progress_photos_prime_fitness.
Sections: Overview, Strength, Cardio, Body & Wellness, Photos. Keep realistic
front/back heatmap and accessible muscle buttons. Preserve weighted/bodyweight/
timed PRs and unilateral/drop calculations. Keep imported labels and separate
cardio metrics. No new body-fat estimates/recovery diagnoses. Photos retain
private access and explicit comparison/share controls; add separate camera/gallery
actions with the existing normalization pipeline.

### Rewards and community

References: rewards_prime_fitness, rewards_shop_prime_fitness,
rewards_community_pod_prime_fitness and rewards_activity_feed_prime_fitness.
Keep Journey/Shop/Community/Activity. Use actual six ranks, current XP thresholds
and server wallet rules. Separate Friends/Challenges/Pods within Community; retain
opt-in, blocking and server eligibility. Pod feed is not chat. Keep real costs,
fulfillment, pending claims and retry reconciliation. Explain XP versus PV beside
balances: level progress versus spendable task-earned rewards, no automatic
conversion, no rank loss when spending PV. Read rates from authoritative rules.

### Profile and supporting flows

References: profile_hub_prime_fitness, notifications_list_prime_fitness,
offline_system_states_prime_fitness, account_paused_prime_fitness and onboarding screens.
Keep Account/Preferences/App & Offline/Data & Privacy. Group imports, backups,
conflicts, installation, queues and feedback settings. Preserve consent, current
invitation/auth flow, mark-read behavior, dirty-close review, export and revision
checks. No passkeys/OTP/System linking from mockups. Paused access follows current
backend restrictions, not imagined archive access. Replace encryption guarantees
with accurate status wording. Add local avatar crop review before upload.

### Staff

References: staff_members_list_prime_fitness and mobile counterpart;
staff_member_detail_prime_fitness; staff_pods_management_prime_fitness;
staff_programs_builder_prime_fitness; staff_exercises_library_prime_fitness;
staff_review_queue_prime_fitness; staff_shop_redemptions_prime_fitness.
Group existing routes into People, Training, Rewards & Reviews, Analytics. Desktop
tables/contextual drawers; phone summary cards/full-width sheets. Map dashboard
composition onto existing summaries. Keep coach/leader scope distinct. Do not
surface medical pause reasons/live presence or introduce bulk writes because a
reference shows them. Preserve reviewed invites, assignment/publication,
fulfillment, targets, stale guards and uncertain-response recovery.

## Design system

| Category | Specification                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| Surfaces | Navy #0F172A; deep #1E293B; raised #223047; row #151F33                                                        |
| Text     | Mist #F1F5F9; silver #CBD5E1; slate #94A3B8                                                                    |
| Accent   | Gold #D4AF37, navy text on fill; at most one primary action per active context                                 |
| Status   | Emerald + #34D399 success text; #F87171 danger text; explicit labels/icons                                     |
| Borders  | Gunmetal decorative; #64748B controls on navy/deep, verify each rendered state                                 |
| Type     | Manrope headings/numbers, Inter body, Tajawal Arabic; local licensed WOFF2                                     |
| Scale    | Title 28/35 phone, 36/44 desktop; section 20/26; card 16/22; body/input 16/24; supporting 14/20; caption 12/18 |
| Spacing  | 4, 8, 12, 16, 24, 32, 48px                                                                                     |
| Radius   | 8 fields/buttons, 12 cards, 16 media/hero/sheets; pills for tags, chamfers for ranks                           |
| Targets  | 44px minimum; primary and workout inputs 48-52px                                                               |
| Depth    | Tonal surfaces/borders; no decorative shadows/glows/gradients                                                  |
| Motion   | 120-180ms colors/opacity; overlays <=200ms; reduced-motion alternative                                         |

Measured examples: slate/deep 5.71:1; navy/gold 8.49:1; control border/deep 3.07:1.
These do not establish all-state compliance.

Responsive: under 768 header/five tabs; 768-1023 labeled 88px rail; 1024+ 240px
sidebar. Gutters 16/32/48. Max widths member 1200, workout 896, staff 1440. Drawers
max 480 desktop/full phone. Keep zoom, scrollbars, safe areas and focus visibility.

Shared components: page frame/header/action; section navigation; exercise/row;
field hints/errors; metric/chart frame; responsive table/list; feedback states;
sync comparison; responsive overlay. Ordinary forms use dialog; consequential
confirmations use alertdialog. Reuse Radix/Lucide rather than generated markup.

Arabic uses Tajawal without tracking/uppercase, logical spacing and directional
controls. Isolate numeric expressions. Do not mirror logo/media/anatomy or reverse
chart data arbitrarily. Retain locale formatting and parser-compatible entry.

## Architecture and integrity

No baseline backend/schema/RLS/reward change. Extend validated section types with
cardio and scoped presentation tabs without changing workout storage versions.
Keep one mounted controller; no duplicate query/mutation owners. Feature hooks
own persistence; reusable display components do not call Supabase or IndexedDB.
Keep stable IDs/revisions/tombstones, frozen snapshots, Cairo dates, canonical
units, imported provenance and server receipts. Scope styles during migration.

Reuse licensed media and existing emblems, retaining attribution/editorial state.
Do not ship generated anatomical art as coaching demonstrations. Keep external
hosting for now. Produce an approved local dark-background logo if needed.

Future backlog, not redesign scope: System linking, auth-method changes, chat,
wearables/Bluetooth, inferred physiology, new exports/rewards/bulk administration.
Noor's optional depth transition uses a reviewable lightweight concept; never
blocks recovery/startup and respects reduced motion.

## Phased backlog and release gates

| Phase | Work                                                                                      | Effort/risk        | Gate                                                  |
| ----- | ----------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------- |
| 0     | Save contract/reference index; P0 reproduction; synthetic baseline and annotated concepts | M / low, bugs high | Design and supported-feature mapping approved         |
| 1     | Tokens/fonts/shell/controls/overlays/feedback/root localization                           | L / medium         | EN/AR, zoom/focus/contrast/routes pass                |
| 2     | Train/session rows/media/tabs/outline/rest/finish/discard/recovery                        | L / high           | Offline/ID/keyboard/device regressions pass           |
| 3     | Today/Nutrition; reward explanation and camera/crop slices                                | L / medium-high    | Totals/drafts/scan review/private uploads correct     |
| 4     | Progress/Rewards/Community; curated muscle discovery                                      | L / medium-high    | Calculation/privacy/reward parity                     |
| 5     | Profile/auth/onboarding/notifications/imports/backups/conflicts                           | L / high           | Consent/isolation/restore/recovery intact             |
| 6     | Staff rosters/editors/queues/analytics                                                    | L / high           | Role matrix, stale reviews and retries pass           |
| 7     | Optional approved emblem transition; physical-device/pilot release                        | M / operational    | No critical integrity/accessibility/recovery failures |

Each phase reports changed behavior, tests and remaining limits. Fix P0 failures
before visual rollout. Use a build-time classic/Studio presentation variant during
development, not a new authorization flag/member preference. Roll back presentation
by previous build without clearing data or changing storage versions. Remove old
presentation after accepted pilot. Pages publishes dist/client only under the
existing /Prime-Fitness-App/ prefix and public-only service-worker policy.

## Verification and acceptance

Baseline start/log/correct/minimize/rest/discard/scan/progress/social/conflict/staff
tasks using synthetic data on fixed devices/network. Record time/actions/errors,
assistance and save-state comprehension; counterbalance old/new task order. Do
not invent percentage improvement targets. Require no worse task success/errors,
faster identified logging tasks and no extra navigation for previously direct
tasks. Record route bytes/requests/media and investigate regressions.

Run format/lint/typecheck/unit, Node and Pages builds/output scans, existing
database/security/reliability/progression/scheduling/photo/import/performance
suites, expanded Playwright and accessibility scans. Browser fixtures do not
replace Android/iOS physical testing or user acceptance.

Cases: blank/decimal/unit edits; delayed evidence; repeated slots; timed holds;
unilateral/drop/warmup/superset; offline reload/restart/quota/tabs/ack loss;
expired/paused/account switch; keyboard/dock; scan denial/uncertainty/portions;
pending totals/undo; role/former-coach/leader restrictions; stale reviews; imports,
receipts/owner-project/conflicts; private-photo cancellation/crop errors.

Widths 320/393/768/1280/1440; EN/AR; 200% text; 400% zoom/reflow; reduced motion;
screen reader/keyboard; iOS Safari/PWA and Android Chrome/PWA.

- [ ] P0 installed Android failures reproduced and fixed with evidence.
- [ ] Concepts approved and sanitized references tracked.
- [ ] Editing/discard/recovery retained; no generated CDN dependencies.
- [ ] Noor's requested photo and reward-comprehension flows reviewed.
- [ ] Permissions/calculations/rewards/history unchanged.
- [ ] Accessibility/RTL and offline tests pass.
- [ ] Baseline/performance comparisons recorded.
- [ ] Rollback preserves drafts/queues; device/pilot gates complete.
