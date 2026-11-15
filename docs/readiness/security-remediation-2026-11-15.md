# Security and migration remediation — 15 November 2026

## State and authorization

Local implementation only. No hosted migration, Auth setting, repository visibility,
history repair, commit, push or deployment was performed. The 14 November blueprint
remains the baseline; this checkpoint supersedes only the findings described here.

## PF-05 and PF-06: forward database fix

Migration [production_access_hardening](../../supabase/migrations/20261115114201_production_access_hardening.sql)
rechecks active access and current coach/Pod-leader role in the legacy
managed-member helper. Assignment/Pod relationships must still be current.
Owner/self policies and the narrower wellness coach helper retain their existing
contracts. This does not change the separate administrator read-policy contract.

It revokes TRUNCATE, REFERENCES and TRIGGER from PUBLIC, anon and authenticated on
public tables, and removes those defaults globally and in public for actual
object owners/default-grant creators/current migration role where the executor
has authority. Hosted postgres cannot assume supabase_admin: its managed default
grants remain a provider follow-up, and the migration emits a warning. CRUD, sequences,
RPC EXECUTE, reward triggers and existing indexes are unchanged. Apply with the
trusted migration owner: insufficient ownership must fail rather than skip revokes.

The new production-access check simulates excessive existing/default grants,
verifies future tables and denied TRUNCATE, and tests actual measurement SELECT
policies for revoked and paused coaches/leaders with relationship rows retained.
Self reads and unrelated-member denial remain covered. It is part of the database
CI suite. These are isolated PGlite checks, not hosted Auth/Storage tests.

## PF-03: content-verified deployment identities

All eight timestamp-mismatched migrations have equal SHA-256 values after **only**
CRLF-to-LF and outer-whitespace normalization. No SQL token/comment/body rewriting
is used. [The checked identity map](migration-identity-map.json) records original
and deployed versions plus the hashes. The other 32 migrations' full statement
content was not compared in this checkpoint.

The original repository SQL and hosted migration records remain unchanged.
The local deployment-workspace generator copies migrations into a new ignored
directory, mapping those eight filenames to their hosted versions and verifying
their content hashes before writing. It rejects output outside artifacts,
workspace reuse, missing mapped files and duplicate version identities. The
generated config contains only the project reference; no credentials are copied.

This is a deployment adapter, not a Supabase migration-history repair. Operators
must use the generated workspace for this existing project. Fresh installations
can use the original repository history. After eight-file mapping, both 41-file
histories replay to identical column, policy, function, constraint and trigger
inventories in isolated databases.

Reproduction, from the application directory:

```powershell
node scripts/check-migration-drift.mjs artifacts/hosted-migration-statements.json
node scripts/prepare-deployment-migrations.mjs artifacts/deployment-migrations-review
node scripts/check-deployment-migrations.mjs artifacts/deployment-migrations-review
npm run test:production-access
```

The hosted-statements artifact is an ignored read-only metadata export, not a
required secret or a checked-in data dump. Export version/name and
array_to_string(statements,E'\n') AS sql for the eight mapped migration names
from supabase_migrations.schema_migrations. The comparator exits 1 for version
drift even when text matches: this is intentional. It never executes SQL.

CLI generation/help used cached Supabase 2.122.0. For an explicitly approved
hosted deployment, refresh the read-only migration list and hashes first, then
run a dry-run using the generated workspace:

```powershell
supabase --workdir artifacts/deployment-migrations-review db push --project-ref iyipukmokidkervphrvb --dry-run --skip-vault
```

Use secure operator credential delivery, not passwords in command arguments.
Dry-run was not executed against hosted infrastructure in this checkpoint.
Expect **only production_access_hardening** as pending; stop for any mismatch.
Review backup/recovery, then separately authorize application without --dry-run.
Never use --include-all to bypass the eight-identity discrepancy or delete old
hosted migration records. Recheck hosted helper definition, effective grants,
default privileges and authorized user operations after deployment.

## PF-09: telemetry privacy

Sentry errors are rebuilt from an allowlist. Free-text error messages, request/
user details, arbitrary tags/contexts/extras, filenames, stack source/local
variables and DOM/navigation breadcrumbs are omitted. Fixed area/error codes,
a validated count, numeric stack locations, release SHA and coarse network
method/status remain. Token redaction utilities alone are no longer relied upon
to recognize arbitrary health text.

Tracing is disabled through sampling and a sampler override (including inherited
sampling), router tracing integration is removed and legacy transactions are
discarded. There is deliberately less diagnostic detail: stack filenames and
source-map resolution are withheld. Restoring them requires a separately verified
privacy contract. Real Sentry alert delivery and SDK outbound-envelope validation
remain operational gates; local canary tests exercise the scrubber.

## Verification

- 19 new production-access assertions passed.
- Existing security 49, admin reviews 23, photos 15, reliability 42, progression
  44, training 50 and redemption retry 17 assertions passed.
- Both migration histories replayed identically across five inventories.
- Six Sentry unit tests passed, including arbitrary health-data canaries.
- Historical performance check passed 720 before/after comparisons. Its original
  report bytes were restored; this historical benchmark does not exercise the
  new helper, which is covered by the new access suite.
- TypeScript, targeted ESLint and Node production build passed after corrections.
  Initial checks exposed strict-type issues and a test fixture with no admin
  authority; those were corrected and checks rerun.
- No browser/device or full hosted-stack acceptance is claimed for these changes.

## Remaining findings

PF-04 leaked-password protection and privileged MFA/session configuration still
require hosted settings work and test identities. PF-02 repository visibility/
history scan, PF-07 manual deployment gating and release identity, PF-08 restore/
alert delivery, and PF-12 full Auth/Storage/API tests remain open.

PF-03 is mitigated by a verified local deployment adapter; actual hosted dry-run
and applied-state verification are pending. PF-05 and application-owned PF-06 grants are fixed locally and
remain live risks until the forward migration is applied. PF-09 is locally
hardened, with external payload/delivery verification pending.

References: [PostgreSQL privileges](https://www.postgresql.org/docs/17/ddl-priv.html),
[Supabase password security](https://supabase.com/docs/guides/auth/password-security).
