# Member onboarding

## Implemented flow

Invitation-based signup, email confirmation, sign-in and password recovery retain
the existing authorization contracts and share the compact Stitch-inspired shell.
New members see Welcome/language, then three real setup steps:

1. Display name and language.
2. Optional training goals, experience, weekly availability and equipment, plus
   metric/imperial display units and explanations of coach programming and RPE.
3. A summary of the actual choices and the existing required safety consent.

Completion saves the profile only after authenticated identity and active access
checks. It requires a returned receipt matching the submitted choices. A lost
acknowledgement locks the request for unchanged retry; reconciliation does not
overwrite another completed setup. Back navigation retains choices within the
mounted wizard. **Unsubmitted answers are not persisted across refreshes.**

The ready screen displays saved choices and checks the actual program assignment.
It offers Today, an assigned program when present, and optional device setup.
Missing programs, read errors and paused access have separate states. Saved
training context is visible in Profile and the authorized coach member overview.
Language and units remain editable in Profile; coaching context is currently
collected during first setup and is read-only there afterward.

Optional Prime Vanguard apps information explains that The System/Prime Finance
account linking is unavailable. Continuing opens device setup, which reuses
Profile's installation flow. Dismissed, failed, requested and confirmed installs
remain distinct. Notifications describe the existing in-app inbox; there is no
background push subscription or fake permission switch.

## Data and deployment

- Forward migration: `20261115131733_onboarding_training_preferences.sql`.
- `profiles.training_preferences` is nullable JSON with validated enums, unique
  goal/equipment selections and optional integer weekly days from 1 to 7.
- Existing profile ownership/staff RLS remains authoritative. No new public
  privileged operation, role, program assignment, prescribed target or reward
  calculation is introduced.
- Export includes this context. Preference-enabled restore validates and restores
  it; old backups that omit it preserve the current value. Explicit null restores
  correctly. Existing backup format versions remain accepted.
- A missing backend column shows an actionable database-update error and retains
  the submitted choices; it never silently discards coaching context.

The frontend change is **local and uncommitted**. On 15 November the authorized
production-access and onboarding migrations were applied to the hosted database,
which now records all 42 migrations. Onboarding's hosted identity is
`20261115135356`. Both applied SQL bodies match their repository versions exactly
after line-ending normalization. The reviewed migration-identity adapter now maps
ten identities; do not push raw repository history against the hosted timestamps.
`artifacts/deployment-postapply-20261115` replays identically to repository history
across columns, policies, functions, constraints and triggers in isolated PGlite.
The live QA smoke also verified the new column. This is distinct from a full local
Supabase replay and does not deploy the frontend. See the
[pre-commit verification report](readiness/2026-11-15-precommit-verification.md).

## Verification: 15 November 2026

- 43 focused unit tests: setup validation, receipt reconciliation, account-change
  protection, backups and coach write authorization.
- 19 database assertions: preference validation, own/unrelated/assigned/former
  coach/admin access, export/restore compatibility and no onboarding XP.
- Existing 42 reliability and 49 security assertions passed on latest migrations.
- Nine onboarding browser cases passed; the broader selected auth/recovery and
  member regression run passed all 24 cases. Tests use synthetic backend data.
- English/Arabic, RTL, 320/393/768/1280px layouts, keyboard focus, reduced motion,
  install outcomes, retained choices and lost-save recovery are covered.
- TypeScript, targeted ESLint and Node production build passed. Pages build
  verified 20 routes and 204 public output files.

Physical Android/iOS installation, screen-reader testing and calibrated Stitch
visual acceptance remain release checks.
Passkeys, one-time-code authentication, adaptive programming, cross-app linking,
background push and extra clinical/profile fields from mockups are separate
features, not working controls in this flow. No exact 1:1 acceptance is claimed.

## Main code

`onboarding-workspace.tsx` coordinates the wizard and receipt recovery;
`onboarding-training-preferences.tsx` collects context;
`training-preferences-summary.tsx` shares its readable presentation;
`onboarding-system-setup.tsx` and `onboarding-device-setup.tsx` handle optional
post-completion screens. `src/lib/onboarding.ts` owns completion and
`src/lib/onboarding-preferences.ts` owns client validation. Run the database
contract with `npm run test:onboarding`; it is included in `test:database`.
