# Architecture improvement follow-up — November 1, 2026

This batch prepares [trusted owner provisioning](owner-provisioning.md) and begins a behavior-preserving workout feature refactor. Nothing was deployed and no hosted account was created or modified.

The [November 2 follow-up](workout-architecture-2026-11-02.md) extracts exercise-card display, advanced options and serialized actions. Counts and remaining-work statements below describe the November 1 snapshot.

## Ownership boundary

New migration `20261101160432_trusted_owner_provisioning.sql` replaces implicit first-signup ownership with an operator-approved, identity-bound, expiring and single-use private receipt. Existing owners remain unchanged. Public signup cannot supply the service-managed application metadata required for first ownership. Normal invitations still determine later account roles. The new server-only operator utility never promotes roles itself or resets a previously created account's password.

The SQL test fixture now includes Auth application metadata, matching the real Auth table. No production Auth columns are added or modified by the migration. All applied migration files remain intact.

## Workout feature boundary

`src/features/workouts/` now owns:

- `types.ts`: the capabilities required by the session view, independent of the complete `useWorkout` hook result. Planned rows require only workout state and transactional changes.
- `workout-set-editor.tsx`: unit-aware draft fields and same-set editing.
- `workout-timers.tsx`: timestamp-based session, hold and rest timers, rest preferences and completion feedback.
- `workout-review.tsx`: finish/discard review presentation and explicit confirmation callbacks.
- `planned-set-rows.tsx`: planned-row presentation and draft interactions.
- `use-workout-wake-lock.ts`: acquisition and cleanup of the optional browser wake lock.

The session orchestrator decreased from 1,468 to 1,079 lines. Timers and dialogs own their presentation state; persistence remains behind the existing controller and domain operations. These modules do not import a concrete workout hook, Supabase client or server credentials. No barrel import, storage format change, new dependency or reward calculation is introduced by this refactor.

Existing set IDs, draft persistence, deletion Undo, rest sharing, timed holds, bilingual labels, finish/discard transitions and server reward authority are preserved. This is the first extraction slice; exercise-card rendering and remaining orchestration still need further decomposition.

## Remaining review work

Continue with exercise-card/orchestration boundaries and Nutrition/import workflow extraction, then measure background sync/query traffic. Repository CI, full local Supabase/Auth/Admin integration, independent database concurrency and physical-device acceptance remain separate work. Keep historical performance reports and already applied migrations intact.

## Verification - November 1

- **353 Vitest tests across 49 files** passed after the refactor.
- **9 operator-workflow tests** passed with injected Auth/database clients; no real account or credentials were used.
- **400 isolated database assertions** passed, including 28 owner-provisioning assertions and the existing 372 security, reliability, training, scheduling, integrity, administration, photo, progression and member-experience assertions. All **37 migrations** replayed successfully.
- The owner suite reproduces the actual Auth Admin ordering: insert the user, update application metadata, then commit. Invalid metadata rolls back registration; a second invited insert in the same transaction cannot bypass verification or clear the pending token. Existing-owner upgrade and invitation behavior remain covered.
- **85 mobile Chromium browser scenarios** passed in one full run against the production build. Coverage includes English/Arabic workout logging, timed holds, set editing, finish/discard, offline recovery and two-tab writes. The backend is mocked for browser scenarios; these are not hosted database acceptance checks.
- **720 historical policy access comparisons** passed, including foreign-key coverage, restrictive policy preservation and rollback. This reruns the existing performance regression report; it is not a production-scale benchmark of the latest schema. The historical comparison inputs remain intact.
- TypeScript, changed-source ESLint, formatting and the production build passed. The existing build/chunk notices remain. The current English/Arabic workout screenshots were generated; the Arabic workout screenshot was inspected for preserved labels, RTL layout and rest controls.

No hosted migration or deployment was performed. Full Supabase/Auth/Admin integration, independent concurrent database transactions, real multi-device operation and physical iOS/Android acceptance remain release gates. Further workout extraction and the Nutrition/import boundaries remain unfinished architecture work.
