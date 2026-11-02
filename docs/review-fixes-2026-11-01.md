# Application review fixes — November 1, 2026

This local implementation addresses five member-workflow reliability findings from the application review. It does not deploy the client, apply hosted migrations, or change existing ownership or reward rules.

## Wellness editing

The daily editor derives its initial values from the saved record. The first edit captures that record's revision; later background/tab updates do not overwrite an unfinished form. Saving preserves untouched values, while clearing an input explicitly saves an empty optional field. Creating a record requires it to remain absent; updating requires the reviewed revision. A stale save retains the draft and offers an explicit reload. Notes have a separate associated label, including when prefilled. Account/date-keyed editors and a submit lock prevent stale form reuse and duplicate submissions.

## Revision-aware offline hydration

Member storage maintains additive, per-entity cache epochs. Local queue changes, acknowledgements and conflict resolution advance the corresponding epoch transactionally. Every server hydration captures a token before fetching; a response spanning intervening local changes is ignored. This covers accepted edits, newly created records omitted from an older snapshot and acknowledged deletions. Within an accepted snapshot, lower server revisions cannot replace newer cached rows. Nutrition availability windows are marked prepared only when both food and water snapshots were accepted.

Existing member payloads without epoch metadata remain readable. Pending queues, stable mutation IDs and personal-backup formats remain intact. Native online queries do not require a cache token when offline storage is disabled.

## Project-scoped workout storage

Workout keys, broadcasts and synchronization locks now include the backend URL and member ID. IndexedDB advances to version 3 while workout payloads remain version 2. Old member-only keys remain available for deliberate recovery; they are never automatically attached to whichever backend is currently configured.

Train shows a legacy-recovery panel when such a record exists. Members can export a raw recovery file with unknown project provenance, or explicitly confirm that the draft belongs to the displayed backend. Adoption is transactional, preserves session/set IDs and pending state, and refuses to overwrite an existing project workout. A failed adoption retains both records. Export alone leaves the original record untouched. Unreviewed legacy drafts also prevent automatic remote-session adoption from obscuring pending local sets. Old application versions cannot reopen the upgraded database at version 2; update/reload other tabs before continuing.

Export and adoption recheck the current account. A late read cannot start a download after the account-keyed recovery panel has been unmounted.

The raw legacy recovery file is an emergency export, not a project-verified personal backup. Keep it until the intended project has accepted the recovered workout.

## Schedule conflict protection

New forward migration: `20261101144237_reviewed_schedule_conflicts.sql`.

The configuration RPC now requires `_expected`, the reviewed mode/start date or null for a new schedule. It compares the expected state under the same advisory transaction lock as the write. Matching-target retries return without resetting moved dates; stale reviews fail before changing occurrences. Completed and in-progress history is preserved. Active coaching permissions remain authoritative. The function stays security-invoker, with no anonymous/public execution grant.

The old three-argument signature is removed so stale clients cannot bypass the check. Apply the migration before releasing this client. Until then, scheduling changes from this client fail closed. The TypeScript RPC contract is synchronized with the signature verified in isolated PostgreSQL; hosted schema/type generation remains a deployment step.

## Notifications

Unread counts use an independent exact count under the existing member permissions. The recent list retrieves a lookahead row and supports older/newer pages. Older unread messages remain actionable, and bulk marking is available even when the newest page contains only read messages. Read errors have retry controls for both the page and unread count.

## Verification and remaining work

Regression coverage includes wellness field preservation and stale tabs; older cache responses after accepted creations/deletions; same-ID project isolation; preserved legacy draft upgrades, exports and adoption; older unread notifications; and stale schedule reviews with protected history. `npm run test:scheduling` runs the new isolated schedule suite. Final verification results are recorded in the implementation report.

The monthly-shield test fixture now handles the first two days of a Cairo calendar month. On month rollover it also verifies a fresh monthly allowance. Shield limits and application rules are unchanged.

Verified locally on November 1:

- 353 unit tests across 49 files passed; the subsequent 19-case storage/recovery run also passed.
- 372 isolated database assertions passed across security, reliability, training, schedule conflicts, integrity, admin reviews, program editing, shop, redemption, photo privacy, progression and member experience. All 36 migrations replayed.
- Browser coverage spans 85 distinct mobile Chromium scenarios. The full run passed 84 and caught a new-check-in creation guard regression. After correcting missing-record creation, three focused offline/wellness/legacy scenarios passed. The legacy scenario passed again against the final build with account-checked export/adoption.
- TypeScript, changed-source ESLint, formatting and the final production build passed. Physical devices, real hosted transactions and deployment acceptance remain separate checks.

At the end of this batch, remaining review work included trusted owner provisioning, extraction of large workflow components, more explicit future migration definitions, measured sync-traffic tuning, full local Supabase/concurrent-transaction tests, repository CI and physical-device acceptance. Bootstrap behavior was unchanged in this batch. The subsequent [architecture follow-up](architecture-improvements-2026-11-01.md) prepares trusted owner provisioning and the initial workout feature extraction locally; its new migration must be applied before relying on the changed bootstrap behavior.
