# Database performance fixes

The [28 October training-depth report](../training-depth-offline.md#latest-schema-query-diagnostics) adds latest-schema diagnostics on 20,000 sessions, 60,000 sets and 100,000-entry food/XP fixtures. Run `npm run test:training:performance`; the historical comparison below remains unchanged.

The [25 October reliability follow-up](../reliability-fixes.md) adds indexed program versions and caller-permission history/backup operations. Its live post-migration advisor check still shows zero performance warnings/errors.

Applied to Prime Fitness on **24 October 2026 (Cairo time)** in migration [`20261023235709_optimize_rls_and_foreign_keys.sql`](../../supabase/migrations/20261023235709_optimize_rls_and_foreign_keys.sql).

## Verified result

| Finding                                           |                  Before |                    After | Treatment                                                                                                                     |
| ------------------------------------------------- | ----------------------: | -----------------------: | ----------------------------------------------------------------------------------------------------------------------------- |
| Repeated authentication evaluation in RLS         |             76 warnings |                        0 | Identity and row-independent role/access checks use statement-level scalar subqueries.                                        |
| Multiple permissive policies for a role/operation |              8 warnings |                        0 | Split broad `ALL` policies into insert/update/delete policies, combining the original read predicates into one select policy. |
| Foreign keys without covering indexes             |             15 findings |                        0 | Added a leading-column index for each reported foreign key.                                                                   |
| Indexes without observed scans                    | 7 informational notices | 22 informational notices | Retained the original seven and the fifteen newly created indexes for the query/access paths described below.                 |

The live catalog check confirms **zero uncovered public foreign keys**, **zero overlapping permissive policy groups**, and **zero public tables without RLS**. The security advisor is unchanged: its only finding is the existing disabled leaked-password-protection Auth setting.

Row-dependent ownership, coach, and Pod checks remain correlated to the current row. Restrictive membership policies remain restrictive. Existing grants, private helper functions, XP/reward rules, and member data are preserved.

## Why the informational index notices remain

An index with zero recorded scans is a review candidate, rather than proof that it should be removed. The seven reported indexes were each only 8 KiB at inspection. Their definitions support these existing app operations:

| Existing index                          | Purpose                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `invites_email_idx`                     | Case-insensitive invite lookup during invite-only signup.                                                              |
| `program_items_program_id_week_day_idx` | Program/week/day loading and the program foreign-key lookup.                                                           |
| `saved_meals_member_created_idx`        | Member-owned favorites ordered by creation date; member foreign-key coverage.                                          |
| `pod_members_member_pod_idx`            | Reverse member-to-Pod lookup, membership checks, and member foreign-key coverage.                                      |
| `pod_activity_pod_time_idx`             | Pod feed filtered by Pod and ordered by time.                                                                          |
| `pod_activity_member_idx`               | Member foreign-key lookup and cascade handling.                                                                        |
| `pod_activity_event_idx`                | XP event foreign-key lookup and cascade handling; the `(pod_id,event_id)` unique index has a different leading column. |

The additional fifteen informational notices refer to the indexes just created to cover the reported foreign keys. Reassess usage after representative traffic, accounting for statistics resets and the importance of foreign-key/cascade operations. Removing these indexes solely to clear a notice would undo required coverage or remove an index matching the app's queries.

## Validation and evidence

```sh
npm run test:db
npm run test:performance
```

- All 16 forward migrations apply successfully to isolated Postgres/WASM; the existing 24 access, XP, privacy, and shield assertions pass.
- **720 before/after access comparisons pass** across 9 account types, 36 tables/views, and 44 write scenarios. Cases include members, other members, outsiders, coaches with active/inactive assignments, Pod Leaders, admins, super admins, paused members, and anonymous callers.
- Positive/negative cases include self-service access, role escalation, target updates, Pod/program operations, private photos, direct XP writes, and favorites ownership.
- All eight restrictive policies remain in place. An isolated `EXPLAIN` confirms statement-level `InitPlan` evaluation. The manual rollback restores the original policy definitions exactly.
- Live Performance Advisor reports zero warnings and zero missing-FK findings; only the 22 informational index notices remain.

These checks verify access equivalence, query-plan structure, and index coverage. Production latency or throughput improvement was not benchmarked; the verification fixtures are intentionally small.

Evidence files:

- [Advisor before](advisor-before.json) and [after](advisor-after.json).
- [Policies before](policies-before.json) and [after](policies-after.json).
- [Index definitions and usage before](index-review-before.json).
- [Local access and plan verification](local-verification.json).
- [Security advisor after](security-after.json).
- [Rollback SQL](rollback.sql), retained for review; use a new forward migration if a production reversal is needed.

The implementation follows the official [Supabase RLS performance guidance](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations). Supabase also advises checking [advisor findings against the intended schema and access model](https://supabase.com/docs/guides/observability/advisors) before changing intentional configurations.

## Client sync request counts - November 2, 2026

The [sync/query traffic follow-up](../sync-traffic-2026-11-02.md) records a separate local HTTP-count benchmark: Nutrition reads decreased from 12 to 3 over 64 idle seconds, and workout session reads from 4 to 2 over 32 seconds after client-side tab navigation. The [aggregate JSON](sync-traffic-2026-11-02.json) includes before/after counts and the initial full-reload baseline. These mocked-backend request counts do not replace the historical database comparison above or establish production SQL latency/cost improvements.
