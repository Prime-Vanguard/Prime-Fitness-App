# Authorization and coaching fixes — 26 October 2026

This first patch batch addresses R1–R4 from the [application review](reviews/2026-10-26-application-review.md), including owner-account protection. Other review findings remain open; this report does not mark the whole review resolved.

## Active shop administration — October 30, prepared locally

Forward migration [`20261030164642_active_shop_administration.sql`](../supabase/migrations/20261030164642_active_shop_administration.sql) adds restrictive active-account checks to reward insertion/update and redemption review, alongside existing administrator policies. A paused administrator role must not permit direct catalogue changes or refund/delivery decisions. The checks use scalar subqueries; read visibility, terminal-review guards, original-cost refunds, stock restoration and ledger/audit triggers are unchanged.

`npm run test:shop-administration` passes 18 isolated database assertions covering unrelated-member writes, active decisions, server actor/timestamp receipts, original-cost refunds after catalogue repricing, single stock restoration, terminal retries and paused-admin mutations. UI operations additionally require fresh admin authority, conditional pending-state/timestamp writes and confirmed receipts. Analytics exports recheck active authority and the latest complete client snapshot before downloading. **The migration remains local and unapplied; hosted rollout and role-matrix verification remain outstanding.**

## Reviewed program administration — October 30, prepared locally

Forward migration [`20261030153540_reviewed_program_editor.sql`](../supabase/migrations/20261030153540_reviewed_program_editor.sql) restricts program, program-item and assignment writes, plus version insertion, to active accounts in addition to existing role policies. The reviewed copy/publication RPC compares a database snapshot under row locks; the reviewed assignment RPC locks the member and checks the expected current assignment. Both are public security-invoker functions. The snapshot helper remains private.

The migration also fixes publication idempotency: comparison now includes logging mode and load convention, matching the existing capture trigger. Previously, retrying an unchanged modern snapshot could create another version. Existing frozen versions are preserved.

`npm run test:program-editors` passes 22 isolated database assertions covering stale previews, exercise metadata changes, stable copy/publication retries, frozen history, assignment conflicts, paused administrators and unrelated members. The existing security, admin-review, reliability and training-depth checks also pass. **This migration is local and unapplied; hosted authorization and deployment verification remain outstanding.**

## Active invitation and PV administration — October 30, prepared locally

The invitation/PV UX work exposed a gap through an isolated latest-schema database test: a paused account with an administrator role could still approve a claim and mint its PV award through a direct update, despite the client preventing it.

Forward migration [`20261030151207_admin_review_active_access.sql`](../supabase/migrations/20261030151207_admin_review_active_access.sql) adds restrictive active-access policies to invitation insertion/update, PV task insertion/update/deletion and PV claim updates. Existing permissive role/ownership policies and server reward/audit triggers remain authoritative. Active checks use scalar subqueries; no new indexes, tables or public security-definer functions are added. Read visibility is unchanged.

Run `npm run test:admin-reviews` for 23 database assertions covering unrelated members, self-review, active administrators, stale decisions, terminal claims, one ledger award per claim, and paused-administrator invitation/task/claim mutations. The existing 49 security assertions also pass. Historical policy comparisons and latest-schema diagnostics were rechecked, preserving the historical report.

**Deployment status:** this migration is tested locally and has not been applied to the live Supabase project. The live authorization gap remains until it is applied. Local tests do not replace hosted role-matrix or production rollout verification.

## Invitation and owner protection — R1

Invitation identity, role, expiry and acceptance fields are immutable through administrative updates. To change an invitation, revoke it and create a replacement. Ordinary admins can revoke pending member/coach/Pod-leader invitations; only super admins can revoke privileged invitations. Accepted and revoked invitations cannot be reopened or rewritten.

The Auth signup trigger can still consume an invitation by setting `accepted_at` through a nested trusted invocation. Regression tests cover actual signup for both ordinary and privileged invitations, rather than only testing direct row updates. No client-callable privileged function was introduced.

Membership access changes are enforced by the profile trigger. Ordinary admins cannot alter owner access, super-admin accounts cannot be paused, and admins cannot pause themselves. These rules now hold for direct API requests, in addition to the existing disabled UI buttons.

## Set/session ownership — R2

A composite foreign key enforces that a set's `(session_id, member_id)` matches its parent workout, including writes by privileged database roles. The set UPDATE policy also checks parent ownership. A supporting child index and unique parent key cover the constraint.

Workout XP qualification explicitly requires an owned positive-rep set. Foreign sets cannot qualify another member's workout for XP or milestones. This patch does not revalue existing XP, change the million-XP curve, or change rank ranges.

Preflight found no mismatched live sets. No historical member records needed modification.

## Paused membership edits — R3

Restrictive UPDATE policies now block paused members from editing workouts, sets, food logs and body measurements. Existing insertion restrictions remain in force. A paused member retains permitted read/export/delete operations; profile/privacy preferences are not turned into a blanket write ban. Favorites already had active-member checks on edits.

The existing shell pause screen remains the user-facing behavior. Reward guards still prevent paused members from gaining new activity or badge XP.

## Atomic coach reassignment — R4

The member-management screen now calls `set_member_coach` once. This security-invoker operation retains RLS, requires an active admin, locks the member profile to serialize reassignment, and validates that the selected coach is active and has the coach role. It reactivates an existing coach/member pair instead of violating the unique historical-pair constraint.

Deactivation and activation commit together. An injected failure after deactivation rolls back the operation and preserves the previous coach. Selecting no coach deactivates assignments in the same operation. The screen disables coach selectors while a reassignment is pending and shows a failure without claiming the change was saved.

## Verification

```sh
npm run test:security
npm run test:db
npm run test:progression
npm run test:reliability
npm run test:performance
npm test
npm run typecheck
npm run build
npm run test:e2e
```

The new security suite applies the latest migrations and checks invitation tampering/consumption, member and privileged signup, owner protection, member/privileged set ownership, paused edits, export/deletion, latest-schema restore retries without duplicate XP, coach reactivation/rollback/removal, member/paused-admin/anonymous denial, FK indexing and absence of exposed public security-definer functions.

The browser test verifies the screen uses one RPC, disables the pending selector, retains the prior selection after a rejected request, reassigns a previous coach and clears the assignment. Browser mocks do not prove database authorization; the isolated database tests cover those rules.

The older review reproduction is now explicitly pinned to the pre-fix migration snapshot. It remains historical evidence of the original findings. `test:security` is the regression suite for the current rules.

Verified on 26 October 2026: 49 security assertions, 24 member/database assertions across 20 migrations, 44 progression assertions, 42 reliability assertions, 720 performance/access comparisons and 49 unit tests passed. All 21 mobile browser scenarios passed. TypeScript, the production build and changed-file ESLint passed; live-generated types include the new relation and coaching operation.

Migration `20261026001321_authorization_and_coaching_fixes.sql` is applied to the connected Prime Fitness Supabase project. Read-only live checks confirmed the invitation trigger, the validated composite ownership FK, exactly one workout/set parent relationship, four restrictive paused-edit policies, the security-invoker coach operation and zero client-callable public security-definer functions. No new security or performance WARN findings appeared. The existing [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) warning remains unchanged; internal receipt-table RLS and unused-index INFO notices are retained for review.

The database tests run in isolated Postgres/WASM, not with live member data. They include injected rollback failures but do not constitute a multi-connection load test. Browser tests use mocked Supabase responses; real invitation email delivery and physical-device acceptance remain separate.

## Remaining work

The subsequent [photo and session batch](photo-and-session-fixes.md) resolves R7, R10 and R14; the [analytics and validation batch](analytics-and-validation-fixes.md) resolves R6, R8 and R9. Remaining review work is R5 archived exercise history, R11 redemption retry identity, R12 date consistency and R13 older-photo selection. Hosted password/MFA and real email/mobile acceptance work also remain separate.

## Development dependency audit — 7 November 2026

Resolved [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) by overriding only `@typescript-eslint/typescript-estree`'s `minimatch` dependency to the patched `11.0.1`. The installed `typescript-eslint` remains at `8.72.1`; no forced downgrade was applied. ESLint's separate, unaffected minimatch 3 dependency remains unchanged.

The patched package supports the project's Node 22 runtime. A direct compatibility check exercised the parser's project-service `allowDefaultProject` matching path using the installed dependency. Relative to the pre-fix lockfile, only the scoped minimatch entry and its new `@isaacs/nonrecursive-glob-match` helper changed. Remove the override when an upstream TypeScript ESLint release accepts the patched minimatch range, then regenerate the lockfile and repeat these checks.

Verification: `npm audit` reports zero vulnerabilities; lint reports zero errors and seven existing Fast Refresh warnings; TypeScript, the production build, the GitHub Pages build/output scan, and an offline `npm ci --dry-run --ignore-scripts --no-audit` lockfile check passed. This dependency-only fix does not change application behavior or database migrations.
