# Workout editor state and recovery - November 2, 2026

Follow-up to the [exercise-card/action extraction](workout-architecture-2026-11-02.md). Changes are local; no deployment, database migration or hosted member-data mutation was performed.

The subsequent [Nutrition follow-up](nutrition-architecture-2026-11-02.md) completes the Nutrition route extraction described under next priorities below. This report retains the workout batch's original verification counts.

## Editor boundary

`src/features/workouts/use-workout-editor.ts` now owns:

- Selected exercise and program slot, including the active-hold switching guard.
- Recovery of per-slot drafts, unit conversion at hydration and logging role/side/pair/drop-root state.
- Previous-performance lookup context and guarded initial defaults. An explicit blank is still an edit, and RPE is never copied as a default.
- Planned-row starting values, copying previous/left-side performance, and calculator-loaded warm-ups.
- Advanced/free-set submission through the existing serialized command runner and durable `change` operation, including stable set IDs, unilateral pairing, planned-row consumption, shared rest and superset advancement.

The hook receives narrow workout/change/online capabilities, units, an error callback and the existing command runner. It does not import a concrete workout controller hook or expose raw state setters. The session composes its typed state and actions with the card, planned-row and dialog components. Existing query keys, storage schemas and domain validators are preserved.

`src/components/workout-session.tsx` decreased from **863 to 626 lines**. The editor hook is **290 lines**. View concerns such as dialogs, feature availability, rest preferences, recovery controls and finish/discard remain in the session; this does not claim all remaining architecture work is complete.

## Warm-up recovery fix

Before the fix, loading a calculator warm-up updated weight/reps and the current UI role but omitted the role from the stored draft. Reloading restored it as a working set. A new browser scenario reproduced that failure against the preceding production build: expected `warmup`, received `working`.

The editor now persists `set_role: "warmup"` in the same draft update as the calculator values. The regression verifies the correct role, 50 kg and five reps after refresh while advanced logging is disabled. Existing server reward rules are unchanged; the fix prevents accidental working-set classification after recovery.

## Verification

- **353 unit tests across 49 files** passed.
- **16 targeted mobile Chromium scenarios** passed against the updated production build, including the new warm-up regression and the 15 existing workout/recovery scenarios.
- A second new scenario passed separately: delay a previous-performance response, enter and deliberately clear both inputs, release the response, then refresh. Reps, weight and RPE remain blank. This batch covers **17 distinct browser scenarios**, not a new full-suite run.
- TypeScript, changed-file ESLint, formatting and the production build passed. Existing Vite/plugin/chunk notices remain.

The browser scenarios use the existing mocked backend. No database definitions, migrations, reward algorithms or controller persistence protocols changed. Hosted integration, real multi-device operation and physical-device acceptance remain release checks; previous database verification counts are historical.

## Next priorities

Extract Nutrition form/validation/offline-write orchestration, then import parsing/mapping/preview/commit workflow boundaries. Measure background sync/query traffic before optimizing it. Keep account isolation, stable IDs, deletion tombstones and persist-before-success behavior intact.
