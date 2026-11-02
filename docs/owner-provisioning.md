# Trusted first-owner provisioning

Updated: November 1, 2026. This workflow is prepared locally; no hosted migration, owner creation or credential change was performed.

## Existing installations

Apply forward migration `20261101160432_trusted_owner_provisioning.sql` in migration order. Existing profiles and roles are preserved. The migration closes provisioning when profiles already exist; it does not create, replace or promote an existing account. Normal invitation-based registration continues to work.

Keep the private provisioning receipt during recovery/rollback. Do not remove it to reopen public bootstrap. Existing-account ownership repair requires a separate, explicitly reviewed database operation.

## Fresh installations

Unapproved public registration now fails even when the profile table is empty. First ownership requires both:

1. A trusted SQL-console approval binding one account UUID, normalized email and token hash for 30 minutes.
2. An Auth Admin API creation request carrying that token in service-managed application metadata.

User-editable metadata cannot satisfy the approval. The transaction takes an advisory lock, verifies the private approval, creates the profile and roles, and consumes the approval atomically. Used approvals cannot be reopened by application roles. Anonymous, authenticated and service roles have no direct access to the private approval table or preparation function.

Supabase Auth writes custom admin metadata after its initial user insert. A deferred constraint trigger reads the stored final metadata before transaction commit; it does not rely on the insert snapshot. Missing or incorrect tokens roll back the Auth row, profile, roles and receipt together. This ordering follows the upstream [Auth Admin implementation](https://github.com/supabase/auth/blob/master/internal/api/admin.go).

The operator utility uses the existing server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never put these credentials or the owner password in `VITE_*` variables, browser code, public assets, command-line arguments or screenshots. Supabase's [Admin createUser documentation](https://supabase.com/docs/reference/javascript/auth-admin-createuser) describes this server-side API.

### Prepare a reviewable intent

Use a protected directory outside all repositories and public folders. The script refuses intent files inside this application, resolves the destination parent directory, and uses exclusive creation so it cannot replace an existing intent. File mode alone does not establish Windows ACLs; use a directory restricted to the operator account.

Example PowerShell, run manually by the operator from the application directory:

```powershell
$ownerIntentDirectory = Join-Path $env:LOCALAPPDATA 'PrimeFitness-Operator'
New-Item -ItemType Directory -Path $ownerIntentDirectory -Force | Out-Null
$ownerIntentFile = Join-Path $ownerIntentDirectory 'first.owner-intent.json'
node --env-file-if-exists=.env scripts/owner-provisioning.mjs prepare 'owner@example.com' $ownerIntentFile
```

Review the backend URL and intended email before running the printed SQL in that backend's trusted SQL console. The printed statement contains the hash, not the raw token. The intent file contains the raw one-time token and must remain private. Preparation does not create an account or send a network request.

Only the database owner/trusted SQL operator can execute `private.prepare_owner_provisioning`. The function refuses populated or previously provisioned installations. A new approval may replace an unused approval, invalidating the older token. Do not generate a new intent after an uncertain account-creation response.

### Create and verify the owner

Within 30 minutes of SQL approval, provide a unique password through a temporary server-side environment variable. For example:

```powershell
$ownerPassword = Read-Host 'Unique owner password (at least 12 characters)' -AsSecureString
$ownerCredential = [pscredential]::new('owner', $ownerPassword)
$env:PRIME_OWNER_PASSWORD = $ownerCredential.GetNetworkCredential().Password
try {
    node --env-file-if-exists=.env scripts/owner-provisioning.mjs create $ownerIntentFile
} finally {
    Remove-Item Env:\PRIME_OWNER_PASSWORD -ErrorAction SilentlyContinue
    $ownerPassword = $null
    $ownerCredential = $null
}
```

The command checks the intent's backend, looks up its stable account UUID, verifies an empty installation before creation, and calls the Admin API with that UUID. The database trigger alone grants the initial roles. The command verifies `super_admin` from `user_roles`, clears the temporary application-metadata marker, and prints only the confirmed account UUID. It does not send an invitation or reset an existing account's password.

After verification, record the account identity securely, remove the consumed intent file, sign in through the normal sign-in form and complete onboarding. Configure real email delivery/recovery separately before member rollout.

## Interrupted requests and failures

- Retry using the same intent file. A completed creation is reconciled by UUID and email; the password and roles are not rewritten.
- If the account exists without the expected owner role or has a different identity, the command stops without promoting or changing it.
- If token cleanup fails, the command identifies the owner as already created and requests a same-file retry. A consumed database approval cannot grant another owner.
- If approval expires before creation, verify that the intended account does not exist, then repeat the same reviewed SQL approval. An existing owner keeps provisioning closed.
- Do not disable signup triggers, bypass the private receipt, or expose service credentials to work around a failure.

## Verification boundary

`npm run test:owner-provisioning` runs mocked operator-workflow tests and isolated PostgreSQL authorization tests. These cover rejected first signup, forged user metadata, identity mismatch, token rotation/expiry/consumption, private permissions, invitation compatibility, lost-response retry and existing-owner preservation. Full hosted Auth/Admin API and independent concurrent-transaction checks remain deployment gates. The application does not expose a provisioning RPC or public setup page.
