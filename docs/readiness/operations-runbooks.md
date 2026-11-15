# Launch, recovery and lifecycle operations runbooks

14 November 2026. **Proposed procedures; not evidence of successful deployment, backups or restoration.** Founder is incident commander/release approver; nominate a second trusted operator before paid beta. Agents diagnose and prepare changes; human owners approve access, spending, communications and releases.

## 1. Release checklist and execution

### Before release

1. Identify the candidate SHA, approved scope, host, Supabase project and rollback artifact. Review all dirty/untracked changes before creating a release candidate. Do not publish the current working tree by accident.
2. Close P1 launch gates in the blueprint; attach passing CI and real-stack critical test evidence. Confirm schema reconciliation before any database push. Confirm English/Arabic phone acceptance.
3. Confirm recent database backup, object backup manifest and successful isolated restore drill. Record actual RPO/RTO. Ensure backup keys, MFA recovery and cloud access work for the backup operator.
4. Check provider incident status, capacity, email deliverability, redirects, TLS, CORS, scanner quota and privacy notice version. Confirm Sentry release identity and canary alert receipt.
5. Configure separate staging/production project identifiers and public browser settings; privileged credentials remain server/operator-only. Keep production data out of previews.
6. Rehearse frontend, Edge Function and flag rollback on staging. Confirm old client compatibility with new schema and service-worker update/offline behavior.
7. Founder records go/no-go, time window, affected users, support coverage and restore point.

### Deployment, when separately authorized

1. Create immutable release tag/artifact from the checked SHA through reviewed CI. Verify artifact digest; never rebuild a different SHA under the same release ID.
2. Apply only approved compatible forward migrations to the named project after preflight; record migration versions and output. Stop on an unexpected pending migration.
3. Deploy the exact frontend artifact and separately versioned Edge Function where changed. Record host deployment ID, SHA, configuration fingerprint (no values) and function version.
4. Check unauthenticated shell/assets/manifest/deep links, no leaked maps/server output, headers and redirects.
5. Using designated synthetic staging identities, test login, invite/recovery, program load, decimal set save/resume/finish, food save, private photo and offline recovery. For production smoke use expressly approved test identities and mark test records for auditable cleanup.
6. Test one reviewed PV approval and redemption with synthetic balances/inventory in staging; require no duplicate ledger entry. Do not manufacture live member awards as a health check.
7. Observe 30 minutes for deployment errors, mutation acknowledgements, sync age and data integrity. Expand flags only to the approved cohort.
8. Record release notes, known limitations and next-day operator check.

### Stop and rollback

Stop rollout on lost accepted data, cross-member visibility, duplicate award, invalid stock/balance, unusable login or unrecoverable drafts. Disable affected feature availability through existing guarded rollout controls when appropriate. Flags do not revoke existing database privileges.

Frontend: deploy the previous compatible immutable artifact and verify PWA update behavior. Never clear member IndexedDB to fix a release.

Edge Function: restore the prior compatible function version and recheck JWT handling/quota. Database: retain schema and fix forward; review repair on a restored copy first. Never automatically run down migrations or restore production over newer valid member activity.

If schema/client compatibility is uncertain, keep a maintenance notice and preserve export/read paths rather than guessing. Run a release smoke after rollback and reconcile all accepted receipts.

## 2. Incident response

| Severity | Examples                                                                    | Operator response target during declared staffed hours | Required action                                                                        |
| -------- | --------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| SEV1     | Privacy exposure, accepted record loss, duplicate PV/XP, destructive access | Acknowledge within 30 min                              | Stop expansion, restrict affected path, preserve evidence, involve founder immediately |
| SEV2     | Login/workout sync outage, repeated failed approvals without corruption     | Within 2 h                                             | Triage provider/application, communicate status, protect drafts and backlog            |
| SEV3     | Visual issue, secondary analytics delay                                     | Next business day                                      | Triage ticket and targeted fix                                                         |

These targets require explicit staffed coverage; there is no assumed 24/7 SRE team. If founder is unavailable, backup operator owns escalation. Do not promise response guarantees unsupported by staffing.

1. Record incident ID, Cairo and UTC timestamps, release/schema IDs and affected aggregate counts.
2. Preserve redacted logs and correlation IDs in restricted incident storage. Never copy health notes/photos into a public issue.
3. Classify outage vs integrity/security; scope with counts and receipt IDs in authorized tools. Avoid broad production member-data queries.
4. Contain narrowly: rollback frontend, disable affected feature, revoke exposed credential/session or reduce traffic as appropriate. Preserve unaffected logging and exports.
5. Send member communications only through authorized operator channels. Founder/legal decides recipient scope, regulator duties and timing; do not invent a legal notification deadline.
6. Reproduce against synthetic data/restored isolated state, test fix, obtain review and release approval.
7. Reconcile ledger/receipts/stock and data completeness before resolution. Keep an audit trail for any compensating correction; never silently edit balances.
8. Within two working days, document impact, root cause, detection gap, recovery timeline and assigned preventive actions. Reopen rollout only with founder sign-off.

## 3. Backup and disaster recovery

### Required inventory

Database data/schema/grants/functions; Auth-related restoration scope; private Storage object binaries; migration history; Edge Function source/version; public build configuration; secret inventory; domain/DNS; CI/environment settings; backup encryption keys. Database backups contain Storage metadata, **not a replacement for object-binary backup**. Verify provider-managed Auth restoration details before relying on them.

Proposed RPO ≤24 hours and RTO ≤8 staffed hours apply only after a drill proves them. Log latest completed backup timestamps separately for database and objects. Pending device-only data has no server backup; provide local export/recovery guidance and explain this limitation.

### Nightly backup procedure

1. Confirm provider database backup completed; verify plan/retention, timestamp and restoration mechanism.
2. Copy private objects through authorized APIs to encrypted offsite storage with versioning or immutability. Use a restricted backup identity where the platform supports it; do not place a service-role key in frontend code or logs.
3. Write an encrypted manifest of object IDs/paths, byte counts, hashes, copy times and matching database backup boundary. Record overlapping writes and reconcile, rather than claim independent copies are atomic.
4. Maintain 7 daily and 4 weekly verified offsite copies as a proposed retention default, subject to counsel/founder policy and cost. Retain operational success metadata without member contents.
5. Alert on failed copy, missing objects, checksum mismatch or backup age >26 hours. Do not delete the previous successful backup on failure.
6. Backup encryption key lives in the organization vault with independently tested recovery access. Do not store its only copy alongside encrypted backups.

No backup job is claimed implemented by this document.

### Isolated restore drill

1. Obtain authorization for a disposable isolated recovery project and costs. Disable outgoing mail/webhooks, public signup and integrations. Prefer synthetic fixtures; real restored data requires restricted access and approved handling.
2. Restore a chosen database backup using the current supported Supabase procedure; restore schemas/grants/triggers without rewriting historical migrations. Record tool/provider versions.
3. Restore corresponding private object versions from the manifest, retaining exact authorized paths and hashes. Reconcile missing/orphan objects without deleting valid new objects automatically.
4. Restore configuration and separately supplied secrets. Reapply current revocations/deletion suppressions so old backups cannot resurrect access or withdrawn data.
5. Validate table/receipt counts, FK/check constraints, role matrix, frozen history, nutrition snapshots, imported provenance, XP/PV balance reconciliation and private-photo access.
6. Run critical member/staff flow tests; compare measured loss window and recovery duration with approved targets.
7. Record drill evidence and erase the disposable recovery environment only after owner approval and retention obligations are satisfied.
8. If a real disaster requires project switch, prepare the new URL/key build and auth redirects, publish compatible client, then reconcile old member/project-scoped queues through explicit destination review/export. Never relabel old pending data silently.

Quarterly drill; monthly sample restoration; repeat after major storage/schema/identity changes.

## 4. Monitoring, SLOs and alert delivery

Use existing Sentry plus Supabase logs first. Do not add an OpenTelemetry collector or paid log drain until actual diagnostic gaps justify cost. Keep traces sampled and inspect trace payloads, not just error events.

| Signal                      | Initial proposed alert                                                           | Route / runbook                               |
| --------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------- |
| Privacy/integrity invariant | Any confirmed loss, cross-user access, duplicate ledger award or negative stock  | SEV1 → incident runbook                       |
| Local durable write         | Any storage/quota failure surfaced; >1% attempts in 15 min with ≥20 attempts     | SEV2 → offline recovery                       |
| Sync backlog                | Oldest retryable pending operation >15 min while authenticated/online for ≥5 min | SEV2; exclude normal offline/auth-paused time |
| Mutation acceptance         | >5% failures in 15 min, ≥20 attempts                                             | SEV2; separate validation/permission denials  |
| Frontend availability       | Two failed synthetic shell checks 60 s apart                                     | SEV2; verify provider status                  |
| Backup freshness            | Latest verified database or object backup >26 h                                  | SEV2 → backup runbook                         |
| Costs/capacity              | 70% forecast monthly budget, then 90%; sustained provider saturation             | Founder planning review                       |
| New errors                  | New release-correlated repeat error, reviewed for actionable severity            | Existing Sentry triage                        |

Count-based alerts are important with low-volume beta. These thresholds are proposed, not configured. Founder approves recipients and tests delivery before enabling.

SLI denominators include eligible authenticated online operations; track rejected validation and unauthorized attempts separately. Measure device persistence independently of network acknowledgement. For 99.5% monthly availability, a 30-day time proxy allows 216 minutes; request-based budgets use eligible request counts instead. Exhaustion freezes feature rollout and prioritizes reliability. Any integrity/privacy invariant breach stops expansion regardless of budget.

Minimal safe telemetry: release/environment, area, error code, counts, latency buckets, operation age and coarse connectivity state. No names, notes, meals, measurements, photo paths, CSVs or token-bearing URLs. Opaque member identifiers still count as personal data and need retention/access controls.

## 5. Maintenance calendar

| Cadence             | Founder/operator work                                                                                                                             | Evidence                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Daily, 15–20 min    | Critical alerts, backup freshness, failed sync/transaction trends, provider health, open incidents                                                | Short restricted operations log                           |
| Weekly, 60–90 min   | Error/support triage, cost and queue-age review, XP/PV reconciliation exceptions, capacity check and next small patch                             | Prioritized backlog and release decisions                 |
| Monthly, 2–4 h      | Reviewed dependency updates, permission/secret access review, database plans/index usage, sample restore, deletion requests and processor changes | Update PR/test evidence, access review and restore record |
| Quarterly, half-day | Full restore, incident rehearsal, role/abuse review, budget and architecture assessment                                                           | Measured recovery and action list                         |
| Annual              | Independent high-risk security review, legal/privacy refresh, account recovery and provider/retention review                                      | Renewed risk/operating decision                           |

Daily work on every day is a human-capacity commitment, not free agent automation. Allocate a backup operator and reduced launch cohort if the founder cannot sustain it.

## 6. Missing control-plane evidence: exact completion steps

- GitHub Settings → General: record visibility decision. Settings → Rules/Branches: required CI checks, PR reviews, force-push/deletion restrictions. Settings → Environments: staging/production reviewers and branch restrictions. Actions: record latest successful main SHA and deployment run, not just PR runs.
- Supabase Authentication: inspect email confirmation, redirect allowlist, password/leak protection, OTP expiry, session/token and rate settings, custom SMTP and MFA. Exercise changes only in isolated staging until reviewed.
- Supabase Database → Backups: record plan, successful timestamps, retention and recovery entitlement. Storage: verify private object limits and backup coverage. Organization access: record owner/admin membership, MFA and scoped operator credentials.
- Sentry: inspect actual environment/releases, quota, event/trace payload canaries, retention and tested alert recipient. Existing docs are not proof delivery works.
- Hosting: identify actual deployed SHA, response headers, TLS/DNS, deep-link/callback behavior and update/rollback route. Complete paid-beta host migration before launch.
- Privacy: founder/counsel records adults/jurisdiction, purposes, retention/deletion and processor approval. Do not label policy text approved merely because it is translated.

Read-only SQL templates for later review (metadata only; not remediation):

```sql
-- Effective whole-table privileges: row policies do not govern TRUNCATE.
select c.relname,
       has_table_privilege('anon', c.oid, 'TRUNCATE') as anon_truncate,
       has_table_privilege('authenticated', c.oid, 'TRUNCATE') as member_truncate
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

-- Hosted migration identity only; compare with versioned repository files.
select version, name
from supabase_migrations.schema_migrations order by version;
```

Never paste secrets, member rows or raw incident traces into these documentation files.
