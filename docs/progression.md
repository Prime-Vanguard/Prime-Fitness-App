# Million-XP progression

Level 100 requires **1,000,000 cumulative XP**. The six existing ranks and their artwork remain unchanged:

| Rank         | Levels | XP to enter |
| ------------ | ------ | ----------: |
| Recruit      | 1–15   |           0 |
| Seeker       | 16–35  |      33,500 |
| Forged       | 36–55  |     153,900 |
| Guardian     | 56–75  |     347,100 |
| Vanguard     | 76–90  |     606,700 |
| Prime Legend | 91–100 |     842,400 |

Thresholds use `round(10000 × ((level − 1) / 99)^1.8) × 100`. This gives quicker early levels and progressively longer later levels. The approved values replace the former provisional curve.

## Earning rates

| Activity                                           |    XP | Limit                                        |
| -------------------------------------------------- | ----: | -------------------------------------------- |
| Completed workout with a positive-rep set          | 3,500 | One per activity day; five per calendar week |
| Nutrition logging with positive calories or macros |   650 | Once per log date                            |
| Body check-in with a positive measurement          |   600 | Once per calendar week; optional             |

Dates use Africa/Cairo; weeks run Monday–Sunday. A workout's activity day is its start date. It must finish after its start and no later than server time. Body rewards recognize recording a measurement, regardless of weight change. Training more often, lifting heavier, or logging extra meals does not multiply daily XP.

The server accepts eligible activity dates from the last seven days, starting seven days before migration deployment. Older history remains importable and saved without fresh XP. This accommodates delayed offline workout sync while limiting bulk backdating at the new rates. Future dates and empty entries do not consume a reward slot.

Four workouts, seven nutrition days and one check-in earn **19,150 XP/week**. The existing fitness milestones add up to 17,000 XP, putting a new consistent member at Level 100 in approximately **52 weeks**. Without check-ins, the same training and nutrition pace is approximately 53 weeks. Three workouts per week takes about 63 weeks; five takes about 44. These are pacing illustrations, not a requirement to train beyond a member's plan or a promise of retention.

The existing one-time badge bonuses are now: First Rep 500; Committed 1,500; Forged in Iron 4,000; Centurion 7,500; Fuel Aware 250; Nutrition Discipline 3,000; Baseline Set 250; Vanguard Contributor 1,000. Previously unlocked badges retain their original ledger award. Workout milestones count rewarded workout days; Nutrition Discipline counts rewarded nutrition days. Existing badges are retained.

## Integrity and transition

The migration snapshots each member's previous level and adds a one-time `level_curve_transition` credit only when necessary to retain that level. Existing XP events remain unchanged. Transition credits do not count toward weekly or Pod leaderboard scores. Existing members can therefore reach the new cap sooner than a new member. PV balances, shop prices, rank boundaries and perks are unchanged.

`public.xp_rules` is a read-only, security-invoker view used by the Rewards guide and internal award triggers. Daily and weekly receipts live in `private.xp_activity_credits`, have RLS and no client access, and survive deletion of source logs. Member-scoped transaction advisory locks serialize reward claims. Retries, reopening a session, deleting/recreating logs and backup restore cannot reset an already credited period. Receipts and XP roll back together if a transaction fails. Paused members receive no new activity or badge XP. There is no client-callable privileged award function.

These controls enforce logging limits; they cannot independently verify that a self-reported workout or meal happened. No new missions or rank perks are introduced by this rebalance.

## Verification

`npm run test:progression` applies the migration in isolated Postgres/WASM and covers level preservation, immutable history, historical receipts, all 100 thresholds, pacing, caps, empty/future/old entries, retries/deletion, milestone deduplication, private access and paused members. `npm run test:db`, `npm run test:performance`, `npm run test:reliability`, unit tests, typecheck and production build cover the existing application. Mobile browser tests mock Supabase and verify the Rewards guide and Prime Legend at Levels 91 and 100.

Verified on 26 October 2026: 44 progression assertions, 24 database assertions across 19 migrations, 720 performance/access comparisons, 42 reliability assertions and 49 unit tests passed. All 20 mobile browser scenarios passed (19 in the full run, and the new progression scenario on rerun after the test was corrected to dismiss the Level 100 celebration). TypeScript, production build and changed-file ESLint passed.

Migrations `20261025233749_million_xp_progression.sql` and `20261025234237_exclude_level_transition_from_leaderboards.sql` were applied to the connected Prime Fitness Supabase project. Live queries confirmed all seven entry/cap thresholds, the canonical earning rates, the leaderboard exclusion, two unchanged existing XP events and zero exposed public security-definer functions. Types were regenerated from the live schema. The advisers reported no new security or performance warnings. The private receipt table intentionally has RLS without client policies (an informational notice); existing unused-index notices remain under review. The pre-existing [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) warning is unchanged.
