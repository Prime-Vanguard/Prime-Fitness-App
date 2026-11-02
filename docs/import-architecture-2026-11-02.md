# Training import boundaries - November 2, 2026

Continues the [Nutrition extraction](nutrition-architecture-2026-11-02.md). Changes are local; no database migration, deployment, real import or hosted member-data mutation was performed.

The subsequent [sync/query traffic follow-up](sync-traffic-2026-11-02.md) completes the measurement and targeted optimization listed below. Counts in this report remain specific to the import batch.

## Changes

`src/components/training-import.tsx` decreased from **823 to 242 lines**. It retains the account-keyed boundary and composes feature modules directly:

| Module                    | Responsibility                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `use-import-workflow.ts`  | File parsing lifecycle, stale-worker guards, mapping/review state, submission locking, batch identity, acknowledged chunks and retry/receipt handling. |
| `use-import-review.ts`    | Active catalogue and member-scoped overlap reads, preserving pagination, date bounds and query keys.                                                   |
| `prepare-import.ts`       | Pure mapping/exclusion and bounded chunk preparation, preserving workout boundaries, source provenance and set/root identities.                        |
| `import-file-step.tsx`    | Provider, units, time zone, DST interpretation and file selection controls.                                                                            |
| `import-review-panel.tsx` | Warnings, exclusions, overlap results and explicit review consent.                                                                                     |
| `import-receipts.tsx`     | Paged receipt history, lazy durable-outcome reads, retry controls and reviewed batch undo.                                                             |

The workflow hook is 323 lines. UI panels receive explicit data and callbacks rather than a concrete hook return type. The pure preparation function imports no React, Supabase client or browser storage.

## Preserved contracts

- Existing Strong, Hevy and FitNotes parsing/validation remains in the original library and Web Worker. The relocated worker URL is statically resolvable by Vite. Cancellation/unmount still increments the parse epoch and terminates the worker; late aliases cannot overwrite touched mappings.
- Unresolved or stale mappings fail explicitly. Excluded sets and fully excluded workouts remain visible in review; they are omitted from submission only after the existing consent flow.
- Chunks still contain at most 100 workouts or 5,000 sets. An oversized individual workout fails before dispatch; a workout is never split between chunks.
- Set IDs, drop roots, pair IDs, source rows, timestamps and date-only records are preserved. Mapped conventions and timed/bodyweight logging behavior retain their previous interpretation.
- Commit RPC names/payloads, per-chunk account checks, stable batch UUID, immutable mapping after submission, acknowledgement checks and durable aggregate receipts remain unchanged. Lost responses retry the same batch; they do not sum uncertain local totals.
- Imported history still earns no XP, streak or schedule credit. Backend provenance, permissions, duplicate protection, undo rules and personal-backup contracts are unchanged.

Retry bookkeeping remains in memory while the page is open. This extraction does not add reload-durable wizard drafts or background imports. After reload, the existing UI still asks members to inspect durable receipts before re-importing the source file.

## Verification

- **361 unit tests across 50 files** passed, including eight new preparation tests for provenance/identity preservation, immutable preview data, mapped logging modes, explicit exclusions, unresolved mappings, both chunk limits, oversized workouts and empty inputs.
- **92 isolated database assertions** passed: 50 training-depth and 42 reliability assertions, covering existing import/reward/provenance/receipt/backup behavior alongside the other training and recovery contracts.
- **Five existing mobile Chromium scenarios** passed: duplicate-safe Strong imports and lost responses, 101-workout multi-chunk retry/durable totals, imported strength records, backup ownership and account-switch isolation.
- One new browser scenario passed in a focused rerun. It checks exclusion consent, refusal of an all-excluded workout, renewed review consent after mapping changes, receipt read failure/retry, cancelling undo without dispatch, and display of an edited-record retention response. That response is mocked; it is not proof of hosted undo behavior.
- The new scenario initially asserted failure before the query's automatic retries completed and used an incorrect cancellation label. Correcting the wait and using the shared dialog's actual `Keep editing` button required no product change.
- This batch covers **six distinct browser scenarios** across the targeted runs, not a new full-suite run. TypeScript, changed-file ESLint, formatting and the production build passed. Existing build/plugin/chunk notices remain. The generated mobile receipt screenshot was inspected for layout and durable totals.

Browser scenarios use the existing mocked backend; database assertions run in isolated PostgreSQL. Real Supabase Auth/RPC integration, independent concurrent transactions, physical devices, screen readers and pilot/release acceptance remain separate checks. No new schema, storage format or dependency was introduced.

## Next priorities

Measure background sync and query traffic with privacy-preserving request counts before optimizing it. Then add repository CI checks. Preserve the historical performance comparison, and keep full Supabase/concurrency/device acceptance distinct from passing local automation.
