# Workout feature extraction - November 2, 2026

Continues the [November 1 architecture follow-up](architecture-improvements-2026-11-01.md). This is a local, behavior-preserving refactor; nothing was deployed or changed in hosted Supabase.

The subsequent [editor-state follow-up](workout-editor-2026-11-02.md) separates draft recovery and submission, fixes calculator warm-up recovery, and reduces the session to 626 lines. The counts below describe this earlier card/action slice.

## Changes

- `src/features/workouts/workout-exercise-card.tsx` owns the exercise header, thumbnail, slot identity, superset label, completed-set list and edit/delete controls. It accepts display data, callbacks and editor children. It does not receive a persistence controller or fetch data.
- `src/features/workouts/workout-exercise-options.tsx` owns the plate/warm-up tools, set role, side, drop-root selector and superset selector. Logging and superset properties have separate typed contracts. The session continues to own their state and durable changes.
- `src/features/workouts/use-workout-actions.ts` owns the existing command lock, busy/error state, deletion/Undo and planned-row completion. It requires only workout state and the existing transactional `change` capability. Local acceptance still precedes success feedback and automatic superset navigation; failed planned-row writes still propagate to the row editor.
- `src/components/workout-session.tsx` composes these modules and retains selection, draft hydration, previous-performance/progression integration and the remaining session workflow. Its size decreased from **1,079 to 863 lines** in this batch, compared with 1,468 before the November 1 extraction.

Card keys and DOM/accessibility structure remain stable. Exercise options still update the same draft fields, unilateral pair IDs and superset references. Deleting a working root still deletes its drop segments; Undo restores their original IDs. Finish/discard, offline queues, storage versions, reward calculations and backend contracts are unchanged. No dependencies or migrations were added.

This extraction improves responsibility boundaries; no rendering-speed or request-volume improvement is claimed. The active draft/editor orchestration remains substantial, and Nutrition/import extraction is still pending.

## Verification

- **353 unit tests across 49 files** passed.
- **14 existing mobile Chromium scenarios** passed against the production build: card drafts/edit/delete/Undo, unilateral recovery and Arabic layout, planned rows and repeated slots, timed holds, cached previous performance, on-demand demonstrations, history, offline finish/retry, warm-ups/swaps/shared rest, two-tab writes and local-storage failure, imperial logging, frozen programs and legacy recovery.
- **One new browser scenario** passed separately. It verifies two ordered drop segments, preserved root selection after reload, side-filtered root choices, and root deletion/Undo restoring all three identities and their relationships. This batch therefore verifies **15 distinct browser scenarios**; it does not claim a new full-suite run.
- TypeScript, changed-source ESLint, formatting and the production build passed. Existing Vite/plugin/chunk notices remain.

Browser tests use the existing mocked backend. No new database checks were needed because database definitions and server operations were unchanged; the November 1 database results remain historical. Physical devices, real multi-device operation and hosted integration remain release checks.

## Next work

Continue separating durable draft/editor orchestration where that creates a clear boundary, then extract Nutrition and import workflows. Measure sync/query traffic before attempting traffic optimizations. Preserve the existing server-only credential boundary, stable IDs, deletion tombstones and persist-before-success behavior throughout.
