# Reliable offline implementation

## Accepted direction

Prepared member and explicitly downloaded staff workflows must survive disconnection,
token expiry, refresh and restart. Local access has no elapsed-time limit; server
writes always require valid authentication and current permissions. Sync runs while
open or reopened. Sensitive staff actions require fresh online review. Private photos,
live social features, first login and recovery remain online.

## Tracker

| Phase                 | Status      | Remaining acceptance                                                                                 |
| --------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| 1. Session continuity | In progress | Unified session controller, hosted refresh/revocation, captive-portal and physical-device acceptance |
| 2. Member preparation | In progress | Physical device acceptance                                                                           |
| 3. Sync coordination  | In progress | Hosted reauthentication and physical storage and update acceptance                                   |
| 4. Staff workflows    | In progress | Expanded authorized downloads, drafts, command receipts and online review                            |
| 5. Pilot/release      | Pending     | Production verification, Android/iOS checks and monitored rollout                                    |

## Phase 1 implementation

- A project-scoped local identity is prepared only after successful `getUser()`.
  Offline restoration reads existing SDK storage without initiating token refresh,
  requires the same account, and grants local UI continuity only.
- Online route verification is bounded to five seconds. Retryable network errors
  retain a prepared identity; rejected authorization does not use the fallback.
- Explicit SDK sign-out removes the offline identity without deleting workout queues.
  It also removes downloaded history and staff offline summaries, so a shared device
  keeps only unsent work. The automatic-download setting is kept for the next sign-in.
- Profile data is saved to the existing member/project-scoped IndexedDB store.
  Offline profile restoration retains onboarding and paused-account state. Cached
  roles do not unlock staff tools; staff download support remains pending.
- Profile shell is included in public PWA precaching for offline settings navigation.

These changes do not establish full offline readiness. Browser data deletion still
removes device-only work. This phase does not change hosted Auth settings or schema.

## Verification — November 17, 2026

- TypeScript typecheck and targeted ESLint: passed.
- 37 targeted unit/hook tests across five files: passed.
- 42 reliability assertions: passed.
- Pages production build and public-output checks: passed (203 files checked).
- All six production Pages browser tests: passed, including an expired saved
  session with offline Nutrition reload, Profile navigation and subsequent
  member denial from admin routes. The fixture refresh endpoint now simulates
  unavailable connectivity instead of returning a malformed user-only session.
- Git diff whitespace checks: passed.

Not yet verified: physical Android/iOS restart/resume; Arabic browser acceptance;
real hosted refresh/revocation behavior; captive-portal browser coverage; durable
reauthentication-required controller state. The current route fallback depends on
the SDK retaining its stored session after a retryable failure. No deployment or
hosted modification was performed. Phase 2 progress is recorded below; phases 3-5 remain pending.

## Code review corrections

- Profile and role requests still run concurrently, but paused/missing profiles
  are handled and persisted independently of stalled role requests.
- Network failures are narrowly identified; unexpected errors reach the error
  boundary. Only recognized authentication failures redirect to sign-in.
- Identity and profile snapshots use versioned runtime schemas. Valid initial
  unversioned snapshots remain readable; unsupported versions, foreign identities
  and malformed account/onboarding fields are rejected.
- Storage writes return preparation status. The shell shows an English/Arabic
  warning when account preparation fails while online access continues. This
  status describes account caching, not readiness of every offline feature.
- Clear action/predicate names replace ambiguous helper names. Profile cache
  parsing and persistence live outside the React hook.
- Regression coverage includes stalled roles with paused/missing profiles,
  invalid cache data, recognized authentication failures, programming errors,
  storage failures and the production-browser preparation warning.

## Phase 2: member data preparation

Implemented a bilingual Offline & sync panel at Profile > App & offline:

- Explicitly download 30 Cairo activity days of food, water, measurements and
  check-ins, plus saved meals and current nutrition targets.
- Save all downloaded entities, coverage metadata and a versioned manifest in one
  IndexedDB transaction. Failed reads, foreign records, account switches and
  concurrent local edits cannot publish a successful preparation result.
- Preserve pending changes, tombstones and newer revisions. Preserve downloaded
  older history rather than pruning it when observers mount. Recent automatic
  nutrition/check-in reads now use the same 30-day boundary.
- Show last download, its covered dates, server row counts, pending personal
  records, workout-draft presence and actionable preparation errors. Download
  counts describe the server snapshot, not pending local edits or all app content.
- Allow a user-initiated persistent-storage request and explain its limits.
- Scope member-data observations to the current account immediately, including
  the render before an account-switch effect executes.

Preparation respects fresh online account checks and the existing offline feature
flag. Private responses remain in account/project-scoped IndexedDB, not the service
worker. No schema, hosted setting, commit or deployment changed.

Validation: the full 472-test unit suite passed, followed by two additional account
switch/history-observer tests and 17 targeted preparation/store tests. All six
production Pages tests passed, including explicit download, offline reload, retained
manifest, English and Arabic RTL controls, and existing account/storage safeguards.
Typecheck, targeted lint, 42 reliability assertions, formatting and production build
checks passed. Existing Vite configuration and vendor sourcemap warnings remain.

At this checkpoint, automatic preparation, training downloads and the remaining
Phase 2 work were still outstanding. The next checkpoint below supersedes that list. Physical iOS/Android and screen-reader acceptance remain unrun.

## Phase 2: automatic and training preparation

- Automatic preparation now runs after the initial account/feature checks, on
  reconnect/focus/resume, and on a five-minute foreground fallback. It downloads
  only missing or out-of-date daily snapshots. Manual refresh bypasses freshness.
- A shared account/project owner coalesces manual and automatic work. Web Locks
  serialize tabs; persisted attempt timestamps prevent immediate cross-tab retry
  storms. Failures retain existing downloads and drafts and appear in the panel.
- A shared loader downloads and validates the assigned frozen program and its
  schedule/occurrences. Both Program and Today use it online and offline. Missing
  downloads produce a recovery error; a verified absent assignment remains distinct.
- Exercise catalogue text is saved without changing active session data, set IDs,
  tombstones, notes or frozen plan names. Media binaries are not downloaded.
- Training completion is recorded only after the required caches commit. Member
  and training caches have separate completion records; a partial workspace
  preparation never implies all app features are ready offline.

Validation: 474 existing unit tests passed, plus new assignment, draft-preservation
and preparation-coordination tests. Seven production Pages scenarios passed,
including automatic download, offline frozen-program launch, starting its workout
and offline reload. Six existing program/schedule browser scenarios passed in
English/Arabic. Two incomplete schedule fixtures were corrected to include the
member/version columns required by the database; ownership checks were preserved.
Typecheck, targeted lint, formatting, standard/Pages builds, 42 reliability and 50
training-depth database assertions passed.

At that checkpoint, workout history and the other remaining Phase 2 tasks were
still pending. The completed-history checkpoint below updates that status. No hosted
schema/settings, commit, push or deployment changed.

## Phase 2: completed-workout history

- Automatic and manual workspace preparation now download the latest 30 Cairo
  activity days of completed sessions, frozen exercise slots and every recorded
  set. Related data is paginated in bounded session batches, including servers
  whose page limit is lower than requested.
- A separate account/project-scoped, versioned history cache is committed only
  after all pages, ownership, slot links and set counts validate. Failed reads
  retain the prior download. Previously downloaded older history is preserved;
  an invalid older cache can be replaced without copying foreign data.
- The existing History list, literal search/date filters, pagination, linked
  workouts, detail view and Repeat action can read downloaded history offline.
  Missing downloads differ from a successful empty download. Device-backed lists
  show the latest refreshed coverage and explain that other history needs internet.
- Frozen labels and advanced set metadata remain intact. Reading or downloading
  history never rewrites the active draft or submits mutations/rewards.
- Server-confirmed workout completion triggers another preparation check. Its
  receipt ID makes same-day history stale; failed refreshes retain their backoff.
  The actual download still requires connectivity and successful persistence.
- The Offline & sync panel shows saved workout/set counts independently of
  personal-record and training preparation status.

Validation: all 492 unit tests and targeted history/coordinator regression checks;
all nine production Pages scenarios (including offline history/Repeat/reload in
English and Arabic); three existing online history/Cairo-filter/frozen-label
browser scenarios; typecheck, targeted lint, formatting, standard and Pages builds,
42 reliability assertions and 50 training-depth database assertions passed.
Existing Vite/vendor warnings remain. Hosted project data and configuration were not changed.

At this checkpoint, additional date-range downloads and offline settings were
next. The selected-workout-range checkpoint below updates that status. Staff workflows, physical Android/iOS PWA tests,
screen-reader testing, hosted-session edge cases and release remain outstanding.

## Phase 2: selected workout-history ranges

- Profile > App & offline now has labelled start/end date controls for additional
  completed-workout downloads. Requests accept at most 366 inclusive Cairo dates,
  reject empty/invalid/reversed/future dates before network activity, and provide
  bilingual validation, progress, failure and durable-success feedback.
- These controls extend completed-workout history only. Personal records retain
  their default 30-day preparation. Members can download multiple date ranges.
- History snapshots and manifests now retain normalized complete-coverage ranges.
  Overlaps and adjacent windows merge; gaps remain explicit. Older snapshots
  without this field retain their existing latest-window interpretation.
- Downloads preserve other ranges, frozen detail data, active drafts and pending
  edits. Default daily preparation recognizes retained recent coverage after an
  older-range download. Out-of-range completion receipts are not falsely marked
  as refreshed by a historical request.
- Same-range requests coalesce; different ranges wait behind active preparation.
  A per-account promise chain supplies same-tab serialization when Web Locks are
  unavailable, while Web Locks retain cross-tab serialization where supported.
- Profile and History show saved date ranges with left-to-right date isolation
  inside Arabic layouts. Offline filters flag incompletely downloaded dates and
  use saved-history-specific empty states rather than claiming no workouts exist.

Validation: the full 504-test unit suite passed, followed by 27 targeted range,
coverage, history and coordinator checks after the final coverage-message change.
All 11 production Pages scenarios passed, including older-range downloads,
retention of recent history, invalid dates, coverage gaps, offline reload and
English/Arabic controls. Typecheck, targeted lint, formatting, 42 reliability
assertions and the Pages production build/public-output checks passed. Existing
Vite/vendor warnings remain. No hosted changes, commit, push or deployment occurred.

## Phase 2: offline personal settings

- On a prepared device, display name, units, language and leaderboard preference
  changes are queued in member/project-scoped storage. The form only shows
  "Waiting to sync" after the device commits the edit. The rest timer remains a
  device setting and can be saved without a server request.
- Pending values survive reload and are shown in the member workspace. A foreground
  sync worker checks the authenticated identity and current account access before
  writing the changed fields. It checks each field against its saved baseline and
  guards the update with the server's current profile revision timestamp.
- A conflicting or rejected edit remains on the device. The Preferences screen
  explains the problem and offers to discard the pending sequence so the member
  can review and re-enter it. Password and private photo changes require internet.
- Validation: typecheck, targeted ESLint and formatting, nine profile hook tests,
  42 reliability assertions, the production Pages build and all 13 Pages browser
  tests passed. The browser suite covered durable offline reload, reconnect and preservation of
  a conflicting server edit using a mocked backend.

## Phase 2: selected personal-record dates

- Profile > App & offline now offers a separate download for up to 366 Cairo
  activity days of food, water, body measurements and wellness check-ins.
- Completed downloads record date coverage in the same device transaction as the
  records. Refreshing one range preserves other dates, pending edits and deletion
  markers. Separate ranges keep their gaps, and manual downloads preserve the
  automatic 30-day preparation schedule.
- Nutrition shows saved totals for downloaded dates, including days with zero
  entries. Dates outside coverage still show when complete totals are unavailable.
  Older dates continue to fetch live Nutrition history when connected.
  Progress opens saved measurements and check-ins after an offline restart.

Validation: 33 targeted tests, 42 reliability assertions, typecheck, targeted
lint and the production Pages build passed. All 14 Pages browser tests passed
with a mocked backend, including an offline restart showing older food, water,
measurements and check-ins, plus empty and undownloaded Nutrition dates.

## Phase 3: foreground retries and recovery overview

- One shell scheduler starts enabled workout, personal-record, cardio and
  preference retries on app open, reconnect, focus and every 15 seconds in the
  foreground. Each queue retains its own write ordering, retry IDs and server
  acceptance checks. Local saves still request immediate sync where supported.
- Profile > App & offline shows workout, cardio and preference status alongside
  personal-record queues and conflict recovery. Each activity links to its
  existing recovery controls. Retry sync requests a pass across the enabled
  queues and asks the member to reconnect if the device is offline.
- Member cache removal now checks the latest device state for pending preferences,
  cardio changes and an unfinished interval timer before deleting anything.
- Validation passed for typecheck, lint, formatting, 17 targeted tests, 42
  reliability assertions, the production Pages build and all 14 Pages browser
  tests with a mocked backend. Browser coverage includes offline queue status,
  retry warning, reconnection and preference conflict recovery.

## Phase 3: queued upload authorization and retry delays

- All four queues check the server-confirmed account and current profile access
  before sending queued work. Immediate sync requests from save flows use the
  same check as foreground retries. Concurrent checks share an in-flight request.
- Each queued mutation uses the verified member's current SDK authorization
  header so an account switch cannot relabel the upload. The server still
  authorizes each mutation under its existing policies.
- Failed access checks delay all queues for that account. A temporary write
  failure delays only the affected queue, starting at 15 seconds and rising to
  two minutes. Reconnect and explicit retry allow a fresh attempt. The delays
  are held in the current tab and restart on reload.
- The hosted access field and profile RLS were checked read-only. All 42
  repository migration identities match the hosted history.
- Typecheck, targeted lint, 48 queue tests, 42 reliability assertions, the
  production Pages build and all 15 Pages browser tests passed. The browser
  used a mocked backend and verified that a paused account keeps its queued
  edit until access is restored and the member retries.

## Phases 1 and 3: shared retry state and sign-in recovery

- Retry delays are stored by project, member and queue. A reload or another tab
  sees the same delay. Browser locks let a waiting tab check again for a newer
  access delay before contacting the server. Browsers that block storage writes
  fall back to delays held in memory.
- When the server rejects a prepared session, the app locks the member view
  and clears its in-memory query cache. The sign-in screen retains a generic
  recovery reminder across reloads. The reminder contains no token or record
  content and cannot open private data.
- Signing in again as the same member returns to the prior app page and allows
  an immediate retry of the existing queues. Signing in as a different member
  starts at Today. Explicit sign-out clears the reminder.
- The hosted migration identities and profile policies were checked read-only.
  The sign-in recovery scenario used a mocked backend. It covers a temporary
  offline failure, a rejected refresh on reconnect, an auth-page reload,
  resuming the queued edit once and a subsequent explicit sign-out.
- Typecheck, targeted lint, 52 targeted tests, 42 reliability assertions,
  the production Pages build and all 16 Pages browser tests passed. The browser
  also verified that a second tab retained the active access retry delay.

## Phase 3: offline storage and application updates

- Profile > App & offline shows an approximate size for removable history and
  the browser's estimated storage usage and quota for the site. The browser
  may include other storage on the same origin in this estimate.
- After review, members can remove downloaded food, water, measurements,
  check-ins and completed workout history. Removal preserves active workouts,
  pending queues, undo data, and assigned training. Local reads from before
  removal cannot republish deleted nutrition records or their coverage.
- Removal pauses automatic history downloads. Download for offline use
  explicitly resumes them. Recent records can still be saved during normal use.
- The service worker keeps supported offline routes on the controlling build
  while an update waits. The app asks members to save open forms, close all app
  windows and reopen. The worker activates through the browser lifecycle and
  leaves IndexedDB drafts and queues in place.
- Typecheck, targeted lint, formatting, 34 targeted tests, 42 reliability
  assertions and the production Pages build passed. All 17 Pages browser
  tests passed, including retention of pending water after history removal and
  a two-tab service worker update that preserved a queued preference.

## Phase 4: explicit staff workout summaries

- Coaches and pod leaders can explicitly save one current roster member at a
  time. Coaches and admins can also use the action in an authorized member
  workspace. The server checks the signed-in actor, active staff role and
  current relationship before and after the download.
- Profile > App & offline shows up to 20 saved summaries from the same account
  and project. Each contains the display name, last completed workout date
  and completed count for the downloaded Cairo week. Device copies are stored
  separately from personal backups and can be removed individually.
- Live staff pages and permissions use their existing guards. The saved view
  provides read-only summaries and cannot open a live staff workspace offline.
  It downloads no email, workout details, nutrition, check-ins or photos.
- When connected, the app verifies access on opening the saved view, reconnect
  and focus. Confirmed loss of access removes the saved summary. Offline, the
  device relies on the last successful verification until it can connect again.
- Hosted read-policy names and all 42 migration identities matched the
  repository checkpoint. Hosted account acceptance and physical device testing
  remain pending.
- Typecheck, targeted lint, formatting, 15 targeted tests, 49 local database
  security assertions and 42 reliability assertions passed. The production
  Pages build and all 18 browser tests passed, including explicit download,
  offline reload and removal after a mocked coach assignment ended.

## Phase 4: nutrition target drafts

- In Admin > Nutrition targets, an active admin can explicitly download targets
  for a selected member. Under Profile > App & offline, they can edit and save a
  device draft, reload it without connectivity, or remove the copy after review.
  Up to 20 target copies are stored per staff account and project, separately
  from personal data. Copies include the member's display name and daily
  targets. They exclude contact details and nutrition logs.
- On reconnect, startup and focus, the device checks current admin access and
  member visibility. Confirmed loss of access removes the affected copy. A
  temporary failure leaves the device copy in place for retry. While offline,
  the device relies on its most recent successful access check.
- Back in Admin > Nutrition targets, choose the same member and select Load
  device draft. Only fields edited offline carry over to the current targets.
  Competing edits are called out for review. Confirmation rechecks the admin
  session and saves against the reviewed server version. Reconnecting alone
  does not submit the draft.
- Once the server confirms success, the device clears the reviewed draft and
  keeps the accepted values for later drafting. A newer draft saved in another
  tab is retained. Refreshing a download also preserves a pending draft.
- Typecheck, targeted lint and formatting, 23 targeted unit tests, 49 local
  security assertions and 42 reliability assertions passed. The production
  Pages build and all 19 browser tests passed. The new phone-sized scenario
  covers Arabic RTL entry, offline reload, online conflict review, and one
  confirmed update that preserves an unrelated online edit. Hosted target
  policy names were checked read-only. Hosted account and physical device
  acceptance remain pending.

Next: add durable submission receipts and extend reviewed offline drafting to
the next staff workflow. Verify both on installed devices and hosted test accounts.
