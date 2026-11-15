# Hosted database inventory and evidence — 14 November 2026

Metadata captured read-only from the linked Prime Fitness project. No member rows were queried. RLS presence and policy text establish configuration, not successful adversarial authorization tests. Full expressions remain in the local, ignored capture `docs/readiness/hosted-metadata-2026-11-14.json`; this reviewed inventory is the repository record.

## Every public table

Commands list policy presence, including restrictive policies: they do not imply every role can execute that command. A dash means there is no direct policy for that command. RPC-only tables must remain default-deny.

| Table                 | RLS     | Policies | SELECT                        | INSERT                                                   | UPDATE                                                  | DELETE                                                  |
| --------------------- | ------- | -------: | ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| audit_log             | Enabled |        1 | audit admin read              | —                                                        | —                                                       | —                                                       |
| badges                | Enabled |        1 | badges read                   | —                                                        | —                                                       | —                                                       |
| body_measurements     | Enabled |        7 | body read                     | active members only; body own insert                     | active members update only; body own update             | active_member_deletes; body own delete                  |
| cardio_logs           | Enabled |        1 | cardio_history                | —                                                        | —                                                       | —                                                       |
| challenge_members     | Enabled |        0 | —                             | —                                                        | —                                                       | —                                                       |
| coach_assignments     | Enabled |        4 | coach assignments read        | coach assignments admin write (insert)                   | coach assignments admin write (update)                  | coach assignments admin write (delete)                  |
| exercise_alternatives | Enabled |        4 | alternatives_read             | alternatives_write_insert                                | alternatives_write_update                               | alternatives_write_delete                               |
| exercises             | Enabled |        4 | Members view active exercises | Admins insert exercises                                  | Admins update exercises                                 | Admins delete exercises                                 |
| food_logs             | Enabled |        7 | food read                     | active members only; food own insert                     | active members update only; food own update             | active_member_deletes; food own delete                  |
| foods                 | Enabled |        3 | foods read                    | foods admin insert                                       | foods admin update                                      | —                                                       |
| friend_challenges     | Enabled |        0 | —                             | —                                                        | —                                                       | —                                                       |
| friendships           | Enabled |        0 | —                             | —                                                        | —                                                       | —                                                       |
| import_batches        | Enabled |        2 | imports_read                  | imports_insert                                           | —                                                       | —                                                       |
| import_receipts       | Enabled |        2 | receipts_read                 | receipts_insert                                          | —                                                       | —                                                       |
| invites               | Enabled |        5 | invites admin read            | active invitation inserts; invites admin create          | active invitation updates; invites admin update         | —                                                       |
| leaderboard_weekly    | Enabled |        1 | leaderboard read              | —                                                        | —                                                       | —                                                       |
| level_thresholds      | Enabled |        2 | levels read                   | —                                                        | levels admin update                                     | —                                                       |
| member_badges         | Enabled |        1 | member badges read            | —                                                        | —                                                       | —                                                       |
| member_blocks         | Enabled |        0 | —                             | —                                                        | —                                                       | —                                                       |
| notifications         | Enabled |        2 | notifications own read        | —                                                        | notifications own mark read                             | —                                                       |
| nutrition_targets     | Enabled |        4 | targets read                  | targets write (insert)                                   | targets write (update)                                  | targets write (delete)                                  |
| photo_deletion_queue  | Enabled |        2 | photo deletion own read       | photo deletion own enqueue                               | —                                                       | —                                                       |
| pod_activity          | Enabled |        1 | feed current pod opted in     | —                                                        | —                                                       | —                                                       |
| pod_members           | Enabled |        4 | pod members read              | pod members admin write (insert)                         | pod members admin write (update)                        | pod members admin write (delete)                        |
| pods                  | Enabled |        4 | pods read                     | pods admin write (insert)                                | pods admin write (update)                               | pods admin write (delete)                               |
| profiles              | Enabled |        2 | own profile read              | —                                                        | own profile update                                      | —                                                       |
| program_assignments   | Enabled |        7 | assignments read              | assignments admin write (insert); editor_active_inserts  | assignments admin write (update); editor_active_updates | assignments admin write (delete); editor_active_deletes |
| program_items         | Enabled |        7 | items read                    | editor_active_inserts; items admin write (insert)        | editor_active_updates; items admin write (update)       | editor_active_deletes; items admin write (delete)       |
| program_schedules     | Enabled |        3 | schedules_read                | schedules_insert                                         | schedules_update                                        | —                                                       |
| program_versions      | Enabled |        3 | versions read                 | editor_active_publish; versions admin publish            | —                                                       | —                                                       |
| programs              | Enabled |        7 | programs read                 | editor_active_inserts; programs admin write (insert)     | editor_active_updates; programs admin write (update)    | editor_active_deletes; programs admin write (delete)    |
| progress_photos       | Enabled |        4 | photos read                   | photos active only; photos own insert                    | —                                                       | photos own delete                                       |
| pv_claims             | Enabled |        5 | claims read                   | active members only; claims own insert                   | active PV claim reviews; claims admin review            | —                                                       |
| pv_ledger             | Enabled |        1 | ledger read                   | —                                                        | —                                                       | —                                                       |
| pv_tasks              | Enabled |        7 | tasks read                    | active PV task inserts; tasks admin write (insert)       | active PV task updates; tasks admin write (update)      | active PV task deletes; tasks admin write (delete)      |
| redemptions           | Enabled |        5 | redemptions read              | redemptions active only; redemptions own insert          | active redemption reviews; redemptions admin update     | —                                                       |
| rewards               | Enabled |        5 | rewards read                  | active reward creation; rewards admin insert             | active reward editing; rewards admin update             | —                                                       |
| saved_meals           | Enabled |        5 | favorites own read            | favorites own insert                                     | favorites own update                                    | active_member_deletes; favorites own delete             |
| session_occurrences   | Enabled |        3 | occurrences_read              | occurrences_insert                                       | occurrences_update                                      | —                                                       |
| set_logs              | Enabled |        6 | View own or managed sets      | Insert own sets in own open session; active members only | Update own sets; active members update only             | Delete own sets                                         |
| social_accounts       | Enabled |        0 | —                             | —                                                        | —                                                       | —                                                       |
| streak_shields        | Enabled |        2 | shields own read              | shields own insert                                       | —                                                       | —                                                       |
| training_pilots       | Enabled |        3 | pilots_read                   | pilots_insert                                            | —                                                       | pilots_delete                                           |
| training_policies     | Enabled |        4 | training_policies_read        | training_policies_write_insert                           | training_policies_write_update                          | training_policies_write_delete                          |
| training_rollout      | Enabled |        2 | rollout_read                  | —                                                        | rollout_update                                          | —                                                       |
| user_roles            | Enabled |        3 | read own roles                | admins grant non-admin roles                             | —                                                       | admins revoke non-admin roles                           |
| water_logs            | Enabled |        6 | water read                    | active members only; water own insert                    | water_owner_update                                      | active_member_deletes; water own delete                 |
| wellness_checkins     | Enabled |        4 | wellness_read                 | wellness_insert                                          | wellness_update                                         | wellness_delete                                         |
| workout_exercises     | Enabled |        1 | workout_exercises_read        | —                                                        | —                                                       | —                                                       |
| workout_sessions      | Enabled |        6 | View own or managed sessions  | Insert own sessions; active members only                 | Update own sessions; active members update only         | Delete own unfinished sessions                          |
| xp_events             | Enabled |        1 | xp read                       | —                                                        | —                                                       | —                                                       |

## Views and privileged functions

All five public views declare `security_invoker=true`: `member_xp_totals`, `pod_leaderboard`, `member_pv_totals`, `xp_rules`, `member_activity_days`. All 26 public security-definer functions have anonymous and authenticated EXECUTE disabled. They include trigger/internal functions; location alone is not evidence of a client-callable escalation. Private-schema helpers still need grant, search-path and caller checks.

## Storage and scheduled work

The sole bucket returned is `progress-photos`, private, 10 MiB limit, `image/*`. Storage policies require an owner folder for upload/delete and allow owner/admin/managed-member reads. MIME allowlisting does not replace binary decoding, EXIF removal and actual Storage API verification. `pg_cron` is not installed; external scheduling and operator-driven cleanup remain unverified.

## Advisor snapshot

Security: leaked-password protection disabled (WARN); 13 RLS-without-policy INFO findings across private internal tables and five public RPC-only social tables. Preserve default-deny; verify social wrapper authorization rather than adding blanket policies. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Performance: 40 unused-index INFO notices, no other returned performance categories. Keep FK and workload indexes until actual plans and representative usage justify removal. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). Health: no notices returned. Advisors are not penetration or load tests.

## Fresh command results

All commands ran on 14 November 2026 against local HEAD 3e70114e5f722f8d8a4e4316fa69f123677d1f5b plus extensive pre-existing working-tree edits. Logs are ignored local artifacts, not guaranteed present on another checkout. Commands below use real script names; no test count is inherited from earlier UI work.

| Check                                                           | Result                                                                                                        | Local log                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| npm run typecheck                                               | Exit 0                                                                                                        | artifacts/readiness-typecheck.log                                        |
| npm run lint                                                    | Exit 0, seven warnings                                                                                        | artifacts/readiness-lint.log                                             |
| npm run format:check                                            | Exit 1, two existing Markdown files                                                                           | artifacts/readiness-format.log                                           |
| npm test -- --pool=threads --maxWorkers=2 --no-file-parallelism | Exit 0, 71 files / 443 tests, 156.30 s                                                                        | artifacts/readiness-unit.log                                             |
| npm audit --json                                                | Retry exit 0, no advisories; first sandboxed registry request failed                                          | artifacts/readiness-audit-retry.json                                     |
| npm run build                                                   | Exit 0; no source-map upload credential detected before running                                               | artifacts/readiness-build.log                                            |
| npm run build:pages                                             | Exit 0, 20 routes / 198 public output files                                                                   | artifacts/readiness-pages.log                                            |
| test:security / reliability / progression                       | 49 / 42 / 44 isolated assertions passed                                                                       | artifacts/readiness-{security,reliability,progression}.log               |
| test:photos / integrity / training                              | 15 / 57 / 50 isolated assertions passed                                                                       | artifacts/readiness-{photos,integrity,training}.log                      |
| test:scheduling / redemptions / admin-reviews                   | 10 / 17 / 23 isolated assertions passed                                                                       | artifacts/readiness-{scheduling,redemptions,admin-reviews}.log           |
| test:program-editors / shop-administration / experience         | 22 / 18 / 38 isolated checks passed                                                                           | artifacts/readiness-{program-editors,shop-administration,experience}.log |
| test:owner-provisioning                                         | Nine operator tests + 28 database assertions passed                                                           | artifacts/readiness-owner.log                                            |
| test:meal-copy                                                  | Seven database assertions passed                                                                              | artifacts/readiness-meal-copy.log                                        |
| test:db                                                         | All 40 migrations replayed; 24 assertions passed                                                              | artifacts/readiness-member-db.log                                        |
| node scripts/check-training-performance.mjs                     | Exit 0, synthetic warm queries                                                                                | artifacts/readiness-training-performance.log                             |
| node scripts/check-experience-performance.mjs                   | Exit 0, no --write-report                                                                                     | artifacts/readiness-experience-performance.log                           |
| Focused mobile Chromium                                         | Five scenarios each reported ok; runner manually interrupted during stuck web-server teardown, process exit 1 | artifacts/readiness-browser.log                                          |

The focused browser command used e2e/member-experience.spec.ts with a name filter for: two tabs preserve both sets; backup preview restores missing logs; wellness edits preserve existing fields; onboarding retains choices; legacy workout drafts require destination. No real accounts or hosted mutations were used.

Warm training diagnostics: 201 members, 20,000 sessions, 60,000 sets, 100,000 food entries, 100,000 XP events, 1,400 wellness rows. Member workout page 0.34 ms; recent sets 2.60 ms; wellness 0.08 ms; full analytics 73.09 ms. Cardio/challenge diagnostics: 31 members, 10,000 cardio rows; date page 1.33 ms, history JSON 4.71 ms, challenge states 22.71 ms. These single warm-query results exclude network, browser, concurrent production load and actual hosted execution. The experience script prints a historical hardcoded date; the command was rerun today and did not overwrite the historical report.

The aggregate test:database command was deliberately not run: it starts with a source-generating encoding script. The historical test:performance script was not run because it overwrites docs/performance/local-verification.json. Their lack of execution is not a passing aggregate gate. Relevant non-generating suites were run individually. Catalogue encoding, complete browser matrix, full Supabase stack and hosted load tests remain outside fresh evidence.

## Additional hosted observations

- Public constraints: 51 primary keys, 80 foreign keys, 65 checks and 14 unique constraints. Catalog inspection returned no unvalidated constraints, invalid indexes or foreign keys lacking a valid non-partial leading-column index. This verifies structural coverage, not workload-selectivity or application semantic correctness.

- Supabase project reports ACTIVE_HEALTHY and Postgres 17.11.0.003 in eu-north-1. No plan, invoice or backup access was inferred from health.
- Forty hosted migrations share local names, but eight later version identities differ; exact mapping is in the blueprint. Deployed statement equivalence remains unverified.
- Effective has_table_privilege checks return TRUNCATE=true for both anon and authenticated on 44 public base tables. No destructive operation was attempted. PostgreSQL whole-table privileges are outside RLS; PostgREST does not thereby expose a TRUNCATE endpoint.
- private.manages_member checks active assignment rows or current Pod membership/leadership, without checking active access or current staff role. private.can_coach_member separately checks active access/current coach role. Real API revocation behavior needs an isolated regression.
- private schema USAGE is false for anon and true for authenticated; inspect individual EXECUTE grants and RPC reachability rather than assuming schema usage alone exposes every helper.
- Hosted public triggers include PV review/ledger, redemption guard/refund, XP activity, immutable program capture, record revisions, occurrence tracking and import provenance guards.
- food-barcode is ACTIVE, version 1, verify_jwt=true. Local source additionally calls getUser and a quota RPC. Source-to-deployed bundle equivalence and actual token compatibility were not tested.
- GitHub connector returned public visibility and main as default. Its commit-workflow lookup is PR-trigger-filtered and returned no runs; this does not establish absent or failing main-push CI.

## Unavailable or unexecuted checks

| Area                              | Current boundary                                             | Exact follow-up                                                          |
| --------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Hosted Auth settings              | Leaked-password advisor only; MFA/session/SMTP not inspected | Authentication settings + synthetic staging recovery/rate/token tests    |
| GitHub protections                | Connector repository metadata only                           | Settings → Rules/Branches and Environments; latest main/deploy run SHA   |
| Actual deployed frontend          | No deployment SHA or browser inspection this audit           | Host deployment artifact/release record and synthetic smoke              |
| Backups                           | No entitlement/timestamps/restore evidence                   | Database → Backups, offsite object manifest, isolated restore drill      |
| Monitoring                        | Local integration and docs only                              | Sentry payload canary, trace scrubbing, recipient delivery and quota     |
| Member production traffic         | Deliberately not queried                                     | Redacted aggregate metrics/plans with scoped permission                  |
| Full Auth/Storage/API integration | PGlite uses substituted identity/object tables               | Disposable full Supabase stack with synthetic accounts                   |
| Physical devices/accessibility    | Historical UI evidence only                                  | Actual Android/iOS PWA and assistive-technology matrix                   |
| Privacy/legal                     | Official law located, current applicability not resolved     | Qualified Egyptian counsel; jurisdiction-specific GCC review             |
| Secrets/history                   | No credentials displayed, no full historical scanner run     | Redacted secret/history and asset-license scan in controlled environment |
