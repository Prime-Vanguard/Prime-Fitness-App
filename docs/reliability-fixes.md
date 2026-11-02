# Reliability fixes — 25 October 2026

Implemented locally and applied to the external Supabase project in [`20261025150310_reliability_fixes.sql`](../supabase/migrations/20261025150310_reliability_fixes.sql). The hosted frontend still needs its normal deployment.

## Programs

Copying week one and reassigning a member now run as separate, atomic database transactions. Failed validation/insertion preserves the old weeks or active assignment. Retrying the same assignment returns the existing assignment. A unique index enforces one active assignment per member.

In Admin → Programs, edit the draft, **Publish draft version**, select a published version, then assign it. Published versions freeze names, duration, prescriptions and exercise labels. Existing assignments were backfilled before enabling this read path. Training retains frozen exercise metadata through refresh, including exercises subsequently disabled in the library.

## History and units

Progress reads every page of sets, workouts and measurements in stable order. Lower REST row caps do not truncate results; failed/non-advancing pages produce an error. Streaks use complete workout/food/shield activity history. Weekly progress uses Monday and Cairo dates. PV totals are aggregated in the database.

Training input, shortcuts, warm-ups, plates, PRs, charts, body measurements, coach workout displays and muscle volume honor the viewer's metric/imperial preference. Storage and backup data remain kg/cm. Imperial plate suggestions use pound plates and bars. Changing units clears open measurement/logger inputs while preserving saved workout records.

## Backup and restore

Profile → **Download full backup (JSON)** creates a versioned account/project-scoped file. Database rows come from one snapshot, independent of the REST row cap. The file includes logs, measurements, favorites, photo metadata and image bytes, profile preferences, the local pending workout, and reference records for programs, roles and reward/account history. Export errors stop the download.

Choose a backup in Profile, review its date and record counts, optionally enable preferences, then select **Restore missing personal data**. Validation checks format/version, owner/project, record ownership, IDs, photo paths and SHA-256 checksums before writing.

- Restore adds missing personal records and preserves existing rows. Core database changes are transactional. Recovered sets retain the workout's finish time. Ordinary server triggers calculate/deduplicate awards; the file cannot set roles, membership, rewards, claims, shields or assignments.
- Photo uploads preserve existing files and reject different content at the same path. Storage and Postgres cannot share a transaction. After an ambiguous failure, uploaded owner-private files remain so retrying can finish safely; the UI reports the failure.
- The local workout is saved after database restoration succeeds. An existing local workout takes priority, and completed server workouts are not reopened locally. Restored drafts open active for review without replaying pending deletions. Local-save failures are reported separately and can be retried.
- Optional preferences restore name, language, units and avatar. Sharing/privacy opt-ins and access settings are preserved.
- Limits: 128 MiB file, 90 MiB of photos, 10 MiB per photo, 100,000 rows per restorable table, 32 MiB database payload. Invalid/oversized operations fail explicitly. Keep the private JSON file securely. This replaces the old multi-section CSV; old CSV/workout-only exports cannot be imported here.

## Validation

Run `npm run typecheck`, `npm test`, `npm run test:db`, `npm run test:reliability`, `npm run test:performance`, `npm run build`, and `npm run test:e2e`.

- 34 unit tests; 24 existing database assertions; 42 reliability assertions covering version backfill, failed-copy/reassignment rollback, export beyond 1,000 rows, deleted-record recovery, repeat restore, reward deduplication, ownership and paused membership.
- The prior performance migration's 720 before/after permission comparisons pass. Current schema checks additionally verify all foreign-key indexes and RLS coverage.
- Ten mobile Chromium tests cover offline recovery, concurrent writes, tools, imperial logging, complete PR/streak history, backup review/restore, and frozen programs across refresh. These use a mocked Supabase HTTP backend. PostgreSQL semantics are tested separately in isolated Postgres/WASM. Physical iOS/Android acceptance and a live-account restore drill remain separate acceptance work.
- Live post-migration: zero uncovered public foreign keys, zero public tables without RLS, two new caller-permission views and no new exposed security-definer functions. Performance advisor: zero warnings/errors; 22 informational unused-index findings retained for query/FK paths. Security advisor still reports existing disabled leaked-password protection.

Changed source files pass ESLint. Existing formatting debt elsewhere is outside these fixes.
