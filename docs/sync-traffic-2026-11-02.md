# Sync/query traffic - November 2, 2026

Continues the [import architecture work](import-architecture-2026-11-02.md). Measured before changing production code, using the production build, mobile Chromium, real timers and the existing mocked backend. No hosted telemetry, database migration or deployment was performed.

## Measured result

| Measurement                                             | Window                               | Before | After | Reduction |
| ------------------------------------------------------- | ------------------------------------ | -----: | ----: | --------: |
| Nutrition data reads: food logs, water logs and targets | 64 seconds idle                      |     12 |     3 |       75% |
| Workout session reads after client-side tab navigation  | 32 seconds idle in an active workout |      4 |     2 |       50% |

The [machine-readable evidence](performance/sync-traffic-2026-11-02.json) retains all observed operation counts. It also preserves the initial full-reload workout baseline: those timers were aligned and already coalesced to two reads. The second baseline used normal client-side tab navigation, which exposed staggered timers and four reads. Before/after comparisons use that same tab-navigation protocol.

These are local HTTP request counts, not production SQL timings, load-time improvements or cost estimates. There are no edits during either measurement window. Notification/badge polling is retained; the change does not eliminate all background requests.

## Changes

### Member synchronization

Previously, every resolved `syncMemberEntries` call invalidated six query groups, including when there was no work to send. A 15-second retry interval therefore caused repeated idle reads.

- Preserve the existing 15-second queue retry interval, reconnect/focus triggers and idempotent sync protocol.
- Publish an acceptance notice only after a validated server acknowledgement has been committed to IndexedDB. Batch it once per flush, including successful groups before a later failure.
- Do not announce empty flushes, malformed acknowledgements, conflicts or wholly failed requests.
- Refresh member-scoped Nutrition, body, wellness, saved-meal, Today and gamification query keys on acceptance. Notices cover writes initiated elsewhere in the app, not just the background component's own sync calls.
- Use the existing BroadcastChannel for project/member-scoped peer notices. Notices contain only the event kind and scope, not record contents. They invalidate caches and confer no permissions. Existing generic storage-change messages remain supported.
- Preserve a **60-second foreground remote refresh**, plus focus/reconnect refreshes, so changes from other devices remain discoverable. This deliberately changes idle remote-refresh cadence from 15 to 60 seconds. Acceptance notices also refresh mounted peer caches; background timer refreshes are skipped while hidden. Browser background throttling still applies.

No database/storage format, revision comparison, tombstone, conflict choice, reward rule or RPC payload changes were needed.

### Workout synchronization

The shell and the workout view each owned a 15-second timer. Their in-flight guard coalesced aligned calls after a reload but not calls staggered by tab navigation.

The shell's `WorkoutSync` remains the single periodic owner. The view retains its initial sync, immediate writes, online/offline/focus handling, local subscriptions and explicit retry action. Finish still waits for all set acknowledgements before requesting server completion/rewards.

## Verification

- **372 unit tests across 52 files** passed. Eleven new tests cover acceptance batching, failed/malformed/conflict responses, partial success, project/member filtering, unsubscribe behavior, unchanged queue retry cadence, slower remote refresh, immediate acceptance, hidden tabs and old-account callbacks. The seven store-event tests passed again after a mock-only lint correction.
- **21 existing mobile Chromium regressions** passed: workout drafts, planned/timed/unilateral sets, supersets, offline completion, food/water edits and Undo, pending totals, stale tabs, favorites, wellness, conflict recovery, failed local writes and account switching.
- A new **two-tab acceptance scenario** passed: hold the server acknowledgement, confirm no reward-query refresh before acceptance, then release it and verify both writer and peer refresh their server reward queries without waiting for polling. Only one mutation request is sent.
- The optimized **request-count benchmark** passed its relative count assertions. Including the benchmark, this is **23 distinct after-change browser scenarios**, not a full-suite run. Before-change measurements were run separately against the preceding build.
- TypeScript, changed-file ESLint, formatting and the production build passed. Existing build/plugin/chunk notices remain.

Browser scenarios use mocked HTTP responses and real IndexedDB/BroadcastChannel/Web Locks. No claim of hosted Supabase/concurrent-device or physical-device acceptance is made. Historical database performance comparison files were not replaced.

## Reproducing the count benchmark

Build first. The test is opt-in and normally skipped, since its real-time windows take about two minutes. From the application directory in PowerShell:

```powershell
npm.cmd run build
$env:PW_SYNC_TRAFFIC = 'after'
npm.cmd run test:e2e -- --grep 'sync request traffic benchmark'
Remove-Item Env:\PW_SYNC_TRAFFIC
```

Without an external server override, the existing Playwright configuration starts and stops the production server. The benchmark uses `artifacts/sync-traffic-before.json` when available, otherwise the committed reference above. Reports store operation names and counts only, never URLs, filters, IDs, headers, record values or request bodies. To establish a genuinely new baseline, run `PW_SYNC_TRAFFIC=before` against the corresponding **pre-change build**, not the optimized build.

## Next priorities

Prepare repository CI for the existing checks, then complete real Supabase/Auth/concurrency and physical-device release verification. Gather hosted aggregate request counts before extrapolating these local savings to deployment traffic or cost.
