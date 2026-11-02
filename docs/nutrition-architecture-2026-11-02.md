# Nutrition feature boundaries - November 2, 2026

Continues the [workout editor follow-up](workout-editor-2026-11-02.md). This is a local refactor of the existing Nutrition workflow; no database migration, deployment or hosted member-data change was performed.

The subsequent [import follow-up](import-architecture-2026-11-02.md) completes the import extraction listed under next priorities below. Verification counts in this report remain specific to the Nutrition batch.

## Changes

The Nutrition route decreased from **1,062 to 366 lines**. It now composes these feature modules directly, without a barrel:

| Module                      | Responsibility                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `contracts.ts`              | Typed URL search state, draft fields, food selection and entry-sheet data/actions.                                                      |
| `use-nutrition-data.ts`     | Food/water/target reads, seven-day cache hydration, pending-record overlays, completeness state and Nutrition/Today invalidation.       |
| `use-food-library.ts`       | Lazy library/recent-food requests with the existing query keys and selection behavior.                                                  |
| `use-nutrition-workflow.ts` | Form state and validation, add/edit transitions, write coordination, food deletion recovery, water logging and copy-yesterday behavior. |
| `nutrition-entry-sheet.tsx` | Search/recent/favorite/quick-entry presentation, portion preview and form controls, using a typed model independent of route globals.   |

The route retains URL validation, daily navigation, macro/water summaries, recovery display and meal history. The workflow receives explicit member/date/offline context and navigation/refresh callbacks. It does not import the route or expose raw form state setters. View and workflow depend on shared contracts rather than importing each other's implementation types.

## Preserved contracts

- Existing `scaleMealItem` validation and consumed-portion arithmetic remain authoritative. Invalid text remains visible; switching methods and cancelling an edit preserve the unfinished add draft and its error.
- Reads retain member filters, pagination, cache-epoch tokens captured before fetching, seven-day windows and pending/conflicted record overlays. Missing totals remain unavailable rather than zero.
- Offline writes still use `queueMemberWrites` before feedback and background sync. Edits/deletes/Undo still use the existing revision-aware domain services, IDs and recovery receipts.
- Water feedback still follows successful acceptance. Favorites still use the existing saved-meal component and atomic expansion behavior.
- Existing URL search keys, query keys, account-change remount/cache boundaries, server authorization, reward rules and storage formats are unchanged. No dependencies were added.

This changes responsibility boundaries, not the interface design or backend API. It does not claim measured query savings, new offline catalogue support, or a complete rewrite of saved meals/water recovery components.

## Verification

- **353 unit tests across 49 files** passed.
- **10 existing Nutrition/offline browser scenarios** passed against the production build: native and queued food edits/delete/Undo, portions, water edit/recovery, stale tabs, Today totals, invalid drafts and older dates, favorites/water feedback, broader offline logging and conflict recovery.
- The existing **account-switch/sign-out regression** passed.
- One new scenario verifies that cancelling an existing-food edit restores an unfinished add draft, portion multiplier and validation error without changing the existing record. Its first run used the wrong test label (`Food name`); correcting the locator to the actual `Food` label required no product change, and the focused rerun passed.
- This batch therefore covers **12 distinct mobile Chromium scenarios** across the targeted runs, not a new full-suite run.
- TypeScript, changed-file ESLint, formatting and the production build passed. Existing Vite/plugin/chunk notices remain. The generated Arabic Nutrition screenshot was inspected for preserved RTL layout, labels and invalid input at the narrow viewport.

Browser scenarios use the existing mocked backend. No database definitions or persistence services changed, so earlier database results remain historical rather than a new database verification claim. Hosted transactions, real multi-device operation, physical keyboards/devices and screen readers remain release checks.

## Next priorities

Separate the training-import parser/mapping/preview/commit workflow, retaining provider validation, duplicate protection, durable outcomes and reward exclusion. Then measure sync/query traffic before optimizing requests. Further saved-meal and recovery-component decomposition can be assessed independently of this completed route extraction.
