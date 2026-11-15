# Prime Fitness: pre-commit verification, 15 November 2026

Status: automated verification complete, with the release limitations below.
At this verification checkpoint no commit, push or frontend deployment had been performed. The two authorized
database migrations have been applied; no repository migration remains pending.

## Hosted database changes

| Migration                       | Repository identity | Applied hosted identity |
| ------------------------------- | ------------------- | ----------------------- |
| Production access hardening     | `20261115114201`    | `20261115135340`        |
| Onboarding training preferences | `20261115131733`    | `20261115135356`        |

The hosted database now records 42 migrations, matching the repository count.
The migration API assigned the hosted timestamps. Both deployed SQL bodies were
compared with the local files, normalizing only line endings and outer whitespace;
they match exactly. Two new mappings were added to
`migration-identity-map.json`, bringing the mapping count to ten. No historical
migration file or hosted migration-history row was rewritten.

Post-application checks confirmed:

- `profiles.training_preferences` exists as JSONB with its validated constraint.
- The member-management helper now checks active membership and current roles.
- Client roles have no `TRUNCATE`, `REFERENCES` or `TRIGGER` grants on public tables.
- No public security-definer function is executable by anonymous/authenticated clients.
- Personal restore includes training preferences.
- Direct hosted validation accepts valid preferences and rejects duplicate goals,
  out-of-range weekly days and unknown equipment.
- Repository and adapted deployment histories replay identically across five
  inventories: columns, policies, functions, constraints and triggers.

The migrations add optional profile context and tighten access. They do not
rewrite programs, member logs or reward history. The frontend was not deployed.

## Automated checks

| Check                                       | Result                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| TypeScript                                  | Passed                                                                                                               |
| Full ESLint                                 | Passed; zero errors, seven Fast Refresh warnings                                                                     |
| Repository formatting                       | Passed                                                                                                               |
| Unit tests                                  | 72 files / 449 tests passed                                                                                          |
| Database suite                              | Passed; all 42 migrations replayed in isolated PGlite                                                                |
| Permission/performance comparison           | 720 comparisons passed across nine roles, 36 tables/views and 44 write cases                                         |
| Training performance fixture                | Passed with 201 members, 20,000 sessions and 1,400 wellness entries; local diagnostics only                          |
| Meal-copy database check                    | Seven assertions passed                                                                                              |
| Node production build                       | Passed                                                                                                               |
| GitHub Pages build                          | Passed: 20 routes, 204 checked public files                                                                          |
| Pages production browser suite              | Six tests passed                                                                                                     |
| Full Chromium browser suite                 | 185 passed initially; four obsolete assertions corrected and all four passed focused rerun; two opt-in cases skipped |
| Selected Firefox/WebKit compatibility suite | 22 passed: 11 Firefox and 11 WebKit                                                                                  |
| Sync request-traffic benchmark              | Passed separately: three nutrition reads in 64 seconds, two workout-session reads in 32 seconds                      |
| Hosted QA smoke                             | 18 checks passed                                                                                                     |
| Dependency audit                            | Zero vulnerabilities                                                                                                 |
| Installed top-level dependency consistency  | Passed                                                                                                               |
| Migration identity replay                   | All five schema/security inventories match                                                                           |

The database suite includes onboarding, production access, catalogue/Arabic
encoding, cardio/social expansion, shields/rewards, reliability, progression,
security, admin reviews, program editors, shop administration, private photos,
data integrity, training depth, scheduling, owner provisioning and redemption
retry identity. It uses synthetic accounts and isolated databases.

The hosted smoke test used the existing multi-role QA account. It checked sign-in,
roles, the profile/new column, authorized reads of the main feature tables and
anonymous profile isolation. It made no writes to member feature records. Login
created a test auth session and local-scope sign-out revoked that session.
It is a live API smoke test, not a destructive live end-to-end scenario.

### Browser findings and corrections

The full Chromium run completed all 191 scheduled cases in 10.8 minutes: 185
passed, four failed due to outdated assertions, and two opt-in cases were skipped.
The corrected four-case rerun passed in 14.9 seconds. Together these verify all
189 functional cases from that suite; this is not a claim that the initial full
run was clean or that it was repeated in full after test-only edits.

- Staff target/Pod draft tests expected a member-only Today link. They now use
  the staff Dashboard link and still assert that navigation triggers draft
  protection and that retained edits survive.
- The 1,105-set pagination test expected unformatted `1105` in an old parent
  layout. It now asserts `1,105` in the metric's definition and still verifies
  that the final-page PR is included while unfinished-session results are excluded.
- The 90-day streak test now checks the redesigned combined `90 · Day streak`
  heading. Its 90-day history fixture is unchanged.

These are test corrections in `e2e/member-experience.spec.ts`, not production
behavior changes or weakened numerical expectations. Targeted ESLint passed.
The skipped cases are controlled Stitch capture and the opt-in request-count
benchmark. The benchmark was then run separately and passed; Stitch visual
acceptance remains open.

The initial compatibility attempt crashed Firefox before navigation under local
process restrictions. Running with process access resolved that issue. Its two
HIIT cases also waited for a service worker while the compatibility config
explicitly blocks workers to preserve API fixture interception. The final
22-case compatibility selection excludes those incompatible cases; real
service-worker/offline behavior remains covered by Chromium and Pages, not by
this WebKit/Firefox subset. Initial diagnostics are retained rather than hidden.

## Advisor findings and release limitations

1. **Auth warning:** leaked-password protection remains disabled. Enable it in
   supported Supabase Auth settings and verify password-change/signup behavior.
   [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
2. **Provider-owned default grants require follow-up:** six excessive default
   grants remain for future `public` tables created by `supabase_admin`:
   `TRUNCATE`, `REFERENCES` and `TRIGGER` for each client role. Current public
   tables have zero such grants. The connected database role cannot administer
   `supabase_admin` defaults (`pg_has_role(..., 'USAGE') = false), which is the
   separate-provider-review case anticipated by the hardening migration. Request
   provider assistance to change these defaults; verify grants after any
   provider-created table. Do not confuse current-table hardening with removal
   of these managed-role defaults.
3. **13 RLS-without-policy information notices:** eight private receipt/control
   tables and five social tables. Their direct access is denied; controlled
   operations remain guarded. Do not add permissive policies just to silence an
   advisor. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
4. **40 unused-index information notices:** low-use indexes need workload evidence
   before removal, especially foreign-key and integrity support. Existing index
   coverage checks pass.
5. Health advisors returned no notices. Seven lint warnings concern mixed
   component/helper exports; they affect development Fast Refresh, not a failed
   production build. Dependency source-map and SDK build warnings also remain in
   raw logs; builds complete successfully.
6. Docker is unavailable on this machine. Full local Supabase/Docker replay was
   not run; PGlite replay plus actual hosted schema/API checks are distinct evidence.
7. Physical Android/iOS PWA, real-camera/barcode behavior, background audio,
   assistive-technology and human usability acceptance still require device/user
   testing. Browser emulation does not replace those checks.
8. Exact Stitch acceptance remains open. The redesign tracker still lists 17/60
   controlled comparisons; automated functional passes do not constitute 1:1
   visual approval. Cross-app linking and background push remain unavailable.
9. No new frontend is live yet. A later commit/push can trigger CI and Pages
   deployment; this report precedes that action.

## Evidence and reproducibility

Ignored `artifacts/readiness-*.log` / JSON files contain the run evidence.
`readiness-verified-browser.log` is the authoritative full browser run.
Earlier partial browser launches used a stale local server and were stopped;
their failures are invalid build/server evidence and are not counted as app
regressions. The current run uses a freshly started server for the verified build.
QA credential JSON files and `.env` / `.env.pages.local` are ignored and untracked.
No credentials or member-record payloads are included in this report.

Primary commands: `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm test`, `npm run test:database`, `npm run test:performance`,
`npm run test:training:performance`, `npm run test:meal-copy`, `npm run build`,
`npm run build:pages`, the full Playwright suite, the Pages suite and selected
tests using `playwright.cross-browser.config.ts`. Cached Firefox/WebKit binaries
are under `artifacts/browser-cache`. Dependency audit required network access.

## Recommendation and next steps

The tested local changes are ready for commit review and the existing CI/testing
deployment process. No unresolved functional assertion failures remain after
the four test corrections. This is **not unconditional production sign-off**:
leaked-password protection, provider-owned default grants, full local Supabase
replay, physical-device/assistive testing and final visual acceptance remain open.

Review this report before committing/pushing. A later authorized commit/push
should exclude ignored credentials and artifacts, include the new source/docs/
migration identity map, and then verify CI and the deployed Pages application.

### Publication authorization

After reviewing the report, the user authorized committing and pushing all local
application work on 15 November. Delivery uses the current `feat/sentry` branch.
Private account credentials, environment files, auth-state caches, raw hosted
metadata and generated build/test artifacts remain ignored. Reviewed reports,
required fonts/licenses, migrations and the deployment identity map are included.
This authorization does not resolve the operational release limitations above.
