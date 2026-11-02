# Training depth and offline experience

Implementation and verification record — **28 October 2026, Africa/Cairo**.

## Release status

The training-depth features are implemented behind rollout controls. Live verification confirms all six public feature switches are disabled, staff access remains enabled, and the pilot allowlist is empty. This is an implementation and automated-verification milestone, not general member-release approval.

The existing Supabase project and first 23 applied migrations were preserved. Training work added eight forward migrations, bringing that pass to 31 migrations. The subsequent [redemption/photo-history follow-up](redemption-and-photo-history-fixes.md) brings the total to 32. Physical training progression remains separate from the existing million-XP curve and rank ranges.

## Features and entry points

| Area                 | Delivered behavior                                                                                                                                                          | Entry point                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Guidance             | English/Arabic guidance editor; equipment/muscle/mode search; rights metadata; explicit alternatives; active-program coverage exceptions                                    | Admin → Exercises; Train → Instructions/library |
| Exercise references  | 1,324 pinned MIT text references, deliberate mapping into existing exercises, retained provenance, unreviewed drafts, internal branded media preview                        | [Dataset guide](exercise-dataset.md)            |
| Set logging          | Weighted/bodyweight/timed modes; working/warm-up/drop roles; unilateral pairs; stored hold timestamps; stable IDs and deletion tombstones                                   | Train → active workout                          |
| History and progress | Completed-workout PRs; timed/bodyweight/side-specific records; per-hand volume; working-pair set counts; immutable historical exercise labels and muscle attribution        | Progress; coach member detail                   |
| Coach progression    | Off by default; double/duration rules; effort ceiling and increments; explanations; revisioned overrides; provisional offline context                                       | Coach member detail; live workout               |
| Scheduling           | Calendar/rotation occurrences; moving unstarted sessions; idempotent starts; repeats with fresh IDs; finished history preserved                                             | Today/Train; coach scheduling controls          |
| Imports              | Strong, Hevy and FitNotes Android CSV adapters; worker parsing; previews/mapping/exclusions; duplicate detection; resumable chunks; durable receipts; unmodified-batch undo | Profile → history import                        |
| Offline records      | Atomic local food/water/templates/body/wellness writes; member/project isolation; seven-day caches; retained pending records; revision conflicts and retries                | Nutrition; Progress; device-sync panel          |
| Rollout              | Staff, public and invited-member controls; per-feature master availability switch                                                                                           | Admin → Members → rollout controls              |

No openGym source, instructions or media were copied. Update on October 30: the user confirmed Gym Visual catalogue licensing and authorized the available visuals. Member thumbnails/player now resolve pinned catalogue references under the Exercise Guidance flag, with proprietary attribution and Prime Vanguard display styling. This does not relabel media as MIT/CC or change database media approvals. See [the current UX implementation report](ux-ui-implementation.md).

## Integrity and compatibility

- Cairo activity dates use shared helpers and refresh after midnight/focus. Actual workout timestamps remain available separately.
- Archived exercises remain available for legitimate history, while excluded from new selection. Immutable workout-exercise snapshots supply names, muscles and measurement conventions even after catalogue changes.
- Existing program prescriptions remain frozen. Policies and overrides do not rewrite them. Suggestions use evidence matching the member, frozen slot, exercise, logging mode and load convention. Imported evidence is excluded unless explicitly enabled by a coach.
- Cached suggestion contexts lacking measurement metadata request a baseline/refresh. Disabled policies suppress stale overrides. Incomplete unilateral pairs do not consume an override.
- Timed work contributes seconds, never estimated 1RM. Warm-ups/drop segments do not inflate strength PRs or progression evidence. Drop segments contribute load volume under their working parent. Imported records are history, not reward/streak/schedule activity.
- Discarding an unfinished occurrence-linked workout returns it to scheduled when its assignment is active, or cancelled otherwise. Completed occurrences do not advance again. Occurrence start operations lock the row and enforce uniqueness.
- Offline acknowledgements must account for the submitted mutations. Incomplete/malformed results retain the queue and show a retry message; they cannot silently delete local work or trigger an immediate retry loop. An older acknowledgement cannot overwrite a newer queued edit.
- Complete online body history remains visible even when seven-day offline caching is enabled. Pending changes overlay server history; pending deletions remain hidden. Reconnect/offline events refresh member-backed views.
- Backup version 2 retains pending records, program-slot IDs, measurement metadata, snapshots and import provenance. Version 1 is explicitly converted. Ownership, set shape, pair uniqueness and drop-parent relationships are checked before restore writes.
- Restore forwards import batches, immutable snapshots and import receipts. Roots and drop segments are inserted in separate statements inside the same restore transaction; sorting JSON alone did not guarantee insert order. Server guards reject foreign provenance. Coach policies/schedule authority are not rewritten by a member restore.
- Local storage upgrades preserve existing drafts. Sign-out hides private state and stops synchronization. Service-worker caches contain public client shells/assets, not authenticated API responses, measurements, photos or mutations.

## Forward migrations

| Migration                                               | Purpose                                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `20261027173536_training_depth_foundations.sql`         | Guidance, snapshots, rich sets, policies, wellness and feature controls            |
| `20261027173541_scheduling_imports_and_member_sync.sql` | Occurrences, imports, mutation revisions/receipts/tombstones                       |
| `20261027174901_training_compatibility_and_context.sql` | Legacy defaults, backup compatibility and authorized training context              |
| `20261027182535_training_integrity_hardening.sql`       | Kill switches, receipt privacy, reward exclusion, provenance and snapshot recovery |
| `20261028131720_training_recovery_fixes.sql`            | Release discarded occurrences without reopening completed history                  |
| `20261028132358_training_backup_provenance.sql`         | Restore owned import receipts and provenance                                       |
| `20261028132818_training_set_restore_order.sql`         | Enforce root-before-drop recovery inside the transaction                           |
| `20261028134231_training_progression_context.sql`       | Match baseline evidence to frozen measurement conventions                          |

All eight are applied to the existing project. Live catalogue checks confirm the recovery trigger/helpers are installed, no authenticated-callable public non-trigger security-definer function is exposed, and all public/private foreign keys have suitable leading-column index coverage.

## Automated verification

| Check                           | Result                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests                      | 146 passing across 24 files                                                                                                       |
| Mobile Chromium browser suite   | 34 passing, including auth, RTL layouts, offline refresh, account changes, imports, guidance, coach policies, history and backups |
| Latest-schema training checks   | 50 assertions passing                                                                                                             |
| General member database checks  | All 31 migrations replayed; 24 access/XP/privacy/shield assertions passing                                                        |
| Security                        | 49 assertions passing                                                                                                             |
| Data integrity                  | 57 assertions passing, including the complete 1,205-member analytics fixture                                                      |
| Photo privacy                   | 15 assertions passing                                                                                                             |
| Million-XP progression          | 44 assertions passing                                                                                                             |
| Reliability                     | 42 assertions passing                                                                                                             |
| Historical policy performance   | 720 before/after access comparisons passing                                                                                       |
| TypeScript and production build | Passing                                                                                                                           |
| Repository-wide ESLint          | Zero errors; seven existing React Fast Refresh export warnings                                                                    |

Some older suites intentionally test historical migration boundaries; the new training checks and general database replay cover the latest schema. Browser tests use mocked Supabase HTTP responses, while database suites exercise policies/triggers in isolated PostgreSQL/PGlite. Neither establishes physical-device acceptance or a full live multi-device concurrency result.

The complete browser run originally found an outdated PR fixture with no completed parent workouts. It now includes both completed and unfinished sessions, verifies pagination beyond 1,000 sets and excludes unfinished sets from PRs.

### Latest-schema query diagnostics

`npm run test:training:performance` creates an isolated, synthetic fixture with 201 members, 20,000 sessions, 60,000 sets, 100,000 food entries, 100,000 XP events and 1,400 wellness records. It checks complete analytics beyond REST row limits and reports warm-query execution plans.

| Query                               | Recorded execution time |
| ----------------------------------- | ----------------------: |
| Completed-workout page              |                 0.38 ms |
| Recent sets with immutable metadata |                 2.52 ms |
| Seven-day wellness                  |                 0.08 ms |
| Complete organization analytics     |                80.57 ms |

These are local PGlite diagnostics, not production latency promises. The [historical performance comparison](performance/README.md) remains intact.

## Remaining release gates

1. **Coach/editorial review:** approve English/Arabic guidance, equipment, load conventions, alternatives and progression behavior for actual assigned programs. Pending editorial status is visible; source text is not treated as coach approval.
2. **Provider evidence:** validate each supported header/parser variant against documented, sanitized real Strong/Hevy/FitNotes Android exports. Current automated fixtures cover parser behavior but do not prove every export/version/localization is supported. Unknown headers fail explicitly.
3. **Full local Supabase:** Docker/Podman was unavailable. Isolated PostgreSQL replay passed; the full local Auth/PostgREST/Storage stack and independent concurrent transaction/device tests remain outstanding.
4. **Physical iOS/Android PWA:** verify installation, playback, timers, restart persistence, storage pressure, session expiry, reconnect and conflict recovery on hardware.
5. **Gym Visual delivery:** catalogue licensing is user-confirmed; preserve the applicable license record and attribution. Pinned upstream delivery is implemented. Complete managed hosting, full exercise mapping/content review and optional durable offline-media support. No AI-generated anatomy or catalogue-file download action is introduced by this resolver.
6. **Hosted Auth setting:** the existing leaked-password-protection warning remains. The advisor reports no new security/performance warnings from these migrations. Private receipt tables intentionally have RLS without client policies; unused-index notices are informational and supporting indexes were retained.

R11 (reward-redemption retry identity) and R13 (older-photo access) were resolved in the subsequent [redemption/photo-history follow-up](redemption-and-photo-history-fixes.md), which records the latest 155-unit/37-browser verification results. The table above preserves this training pass's earlier results.

## Pilot and rollback

Complete the gates per phase before inviting members. Use Admin → Members to add explicit pilot identities. Public switches remain off until the pilot is accepted. Do not turn all phases on merely because automated checks passed.

Monitor outcome/status counts, sync queue age, conflicts, import receipts, duplicate skips, suggestion holds and occurrence conflicts. Do not log wellness notes, measurements, CSV rows or authentication secrets.

For a lost record, cross-member exposure, duplicate award or unrecoverable draft, disable the affected feature's master availability switch. Preserve local/server data, export pending records where possible and ship a forward fix. Do not drop populated columns, remove receipts, downgrade storage formats or delete pending queues as rollback.
