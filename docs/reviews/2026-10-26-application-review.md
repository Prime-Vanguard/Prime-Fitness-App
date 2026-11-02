# Prime Fitness application review — 26 October 2026

Status: original review snapshot. The review itself did not change application behavior or production data. The [authorization and coaching patch](../security-fixes.md) addresses R1–R4 and owner-account protection; the [photo and session patch](../photo-and-session-fixes.md) addresses R7, R10 and R14; the [analytics and validation patch](../analytics-and-validation-fixes.md) addresses R6, R8 and R9. The [training-depth and offline patch](../training-depth-offline.md) addresses R5 and R12. The [redemption and photo-history follow-up](../redemption-and-photo-history-fixes.md) addresses R11 and R13. The remaining configuration/release recommendations stay open. Evidence below describes the original reviewed snapshot.

Two high-priority security bugs were reproduced in the reviewed snapshot: an ordinary admin could elevate an invitation to super admin, and a member could move an owned set into another member's workout. The subsequent patch closes those paths. The historical evidence below is retained, alongside the remaining reliability and privacy findings.

## Scope and evidence

Reviewed authentication/session handling, administrative roles/invitations, coaching/Pods, programs, live training and IndexedDB sync, nutrition, progress/photos, backups, XP/PV/reward redemption, analytics/CSV export, notifications and PWA/deployment configuration. Reviewed the 19 migration files and representative live policies/configuration using read-only Supabase queries. Not every possible interaction or concurrency interleaving was exercised.

Evidence labels below distinguish:

- **Reproduced:** executed against an isolated Postgres/WASM database using all current migrations. No remote credentials or live test users.
- **Code-confirmed:** a specific reachable code path or missing check is visible; additional end-to-end or failure-injection coverage is still required.
- **Risk to verify:** a plausible interaction needs targeted browser/production verification before claiming an observed exploit.

Run the review-only database demonstrations from the app directory:

```sh
node docs/reviews/2026-10-26-reproduce.mjs
```

The script is pinned to the pre-authorization-fix migration snapshot and asserts that the original vulnerabilities were present. It is **not** the current security regression suite. Use `npm run test:security` to verify the patched authorization and coaching behavior.

P1 means the next security patch. P2 means the subsequent reliability/privacy batch. No unauthenticated account-takeover exploit was established in this review.

## P1: security fixes

### R1. Ordinary admins can elevate invitations to super admin

**Reproduced; live policy also verified.** Requires an authenticated ordinary `admin`; this is an admin-to-super-admin boundary failure.

The invitation INSERT policy restricts privileged roles, but its UPDATE policy only checks `private.is_admin(auth.uid())`. An ordinary admin can create a member invitation, update its role to `super_admin`, and the signup trigger grants that role to the invited account. The restricted role selector in the UI does not prevent direct authenticated API requests.

Evidence: `supabase/migrations/20261023202122_e0bb50b6-5f3e-4d7f-86cb-a1a631bb6716.sql:159`, signup trigger in the same file; optimized policy in `20261023235709_optimize_rls_and_foreign_keys.sql:73`. The isolated test performed this full sequence and observed the resulting super-admin role.

Fix: limit ordinary invitation updates to revocation, or enforce immutable invitation identity/role and privileged-role checks in a server trigger. Apply role checks to both the old and new row. Reserve privileged invitations and owner-account access changes for super admins. Include tests for changing invitation email/role/acceptance fields, reusing accepted invitations, and attempting to pause the owner through the API. The current owner-pause guard is also only a disabled button in `admin.members.tsx`; the profile guard checks general admin status.

Acceptance: an ordinary admin cannot create or transform any invitation into an admin/super-admin invitation. An authorized super admin can still invite privileged users. Ordinary admins cannot suspend a protected owner account.

### R2. Set updates do not enforce ownership of the parent workout

**Reproduced; live policy also verified.** Requires an authenticated member with an owned set and knowledge of a target workout UUID. No cross-member data read was demonstrated.

INSERT checks that the session belongs to the caller and is open. UPDATE only checks the set's `member_id`. A member can therefore change `session_id` to another member's workout while keeping their own `member_id`. Foreign-key checks do not substitute for parent ownership checks.

The isolated test moved A's set into B's empty workout. When B finished it, the XP trigger's `EXISTS (... WHERE session_id = NEW.id AND reps > 0)` counted A's set and awarded B 4,000 XP, including the first-workout badge.

Evidence: `supabase/migrations/20261023203225_d5498fa5-c765-4b80-8bee-a636abc1f1b8.sql:65`; optimized policy at `20261023235709_optimize_rls_and_foreign_keys.sql:202`; XP qualification at `20261025233749_million_xp_progression.sql:105`.

Fix: enforce matching session/member identity on both INSERT and UPDATE, preferably with a durable database invariant and RLS. Make ownership immutable; define whether moving a set between a member's own workouts is supported. Add the member predicate to XP qualification as defense in depth. Define a supported path for editing completed history rather than relying on permissive updates.

Acceptance: reparenting a set to an unowned session fails even when the attacker knows its UUID. A workout cannot earn XP from another member's sets. Ordinary offline retries and personal backup restore continue to work.

## P2: confirmed functional and data problems

### R3. Membership pause blocks inserts but not edits

**Reproduced.** After pausing a member, authenticated UPDATE requests still changed an existing set's reps and a workout's notes. The shell hides these controls, but that does not enforce the backend rule.

Evidence: the `active members only` policies in `supabase/migrations/20261023211126_324cdf88-d693-457b-aac6-227fe54001cf.sql:6` apply to INSERT only; owner UPDATE policies have no access-active condition. Recent XP triggers correctly suppress new XP for paused members, so this test did not bypass that new reward guard.

Fix: define the intended paused-member permissions explicitly, then enforce UPDATE restrictions on the relevant tables. Decide separately whether privacy operations such as exporting/deleting personal data remain available. Do not indiscriminately block those operations.

### R4. Reassigning a previous coach can remove current coaching

**Reproduced.** The UI deactivates existing assignments, then inserts a new row. The schema has a unique `(coach_id, member_id)` constraint, including inactive history. Reassigning a coach who was used before fails with `23505`, after the old coach has already been deactivated. A failed network request can also leave this two-request operation incomplete.

Evidence: `src/routes/_authenticated/_shell/admin.members.tsx:73`; unique constraint at `supabase/migrations/20261023202122_e0bb50b6-5f3e-4d7f-86cb-a1a631bb6716.sql:78`.

Fix: one permission-checked, transactional reassignment operation that reactivates the existing pair or creates it and only commits the complete change. Match the constraint to the product decision about one versus multiple active coaches.

Acceptance: A → B → A works; failure preserves the previous active assignment; simultaneous requests have a defined result.

### R5. Archiving an exercise breaks historical labels and heatmap attribution

**Reproduced.** Members can read their historical set but cannot read its exercise after an admin sets `active=false`. Progress loads names separately through the exercise RLS policy, so the record label becomes blank; muscle-volume calculation treats the set as unmapped. Frozen program snapshots preserve some training metadata, but do not fix the separate history queries.

Evidence: exercise SELECT policy at `supabase/migrations/20261023203225_d5498fa5-c765-4b80-8bee-a636abc1f1b8.sql:17`; `src/routes/_authenticated/_shell/progress.tsx` exercise lookup/name fallback; `src/lib/muscle-volume.ts`.

Fix: allow read access to archived exercise metadata when referenced by the caller's own or legitimately managed history/assigned program, or persist immutable exercise metadata with historical records. Keep archived exercises out of the new-exercise picker.

### R6. Important numeric constraints are missing

**Reproduced.** The database accepted negative water, negative protein, negative body weight and body fat above 100%. Body-fat input also lacks a maximum in the normal measurement form, so this is not exclusively a crafted-API scenario.

Evidence: `supabase/migrations/20261023205423_ba81db7a-8f6e-410b-9a6b-d18cfd3f7286.sql:2`; its food validator only checks meal and calories; `src/routes/_authenticated/_shell/progress.tsx:274` accepts any positive body-fat number.

Fix: matching client/server validation for finite numeric values, nonnegative macros, positive water/measurements when provided, body-fat percentage bounds and target-field sanity. Review existing invalid records before adding constraints. Preserve canonical kg/cm storage and optional null measurements. These are data-integrity limits, not personalized health targets.

### R7. Photo deletion can leave sensitive objects behind

**Code-confirmed; storage failure was not injected into live photos.** Metadata is deleted first. The subsequent Storage `remove()` result is ignored, and the list is refreshed regardless. If that request fails, the photo vanishes from the gallery but its object remains, with no in-app retry reference. Existing authorized storage access can still retrieve it. Similar ignored cleanup errors exist in the upload rollback path.

Evidence: `src/components/progress-photos.tsx:74`; upload cleanup at line 68; storage read authorization in `20261023213758_a35d3fae-ddb7-4f35-b2f9-c346f321cc78.sql`.

Fix: use a deletion state with retained object path and retryable cleanup. Surface failures, and only report completed deletion after storage deletion is confirmed. A server cleanup job can reconcile pending deletions and orphaned objects. Handle signed-URL/cache expiry explicitly; do not promise immediate revocation without testing it.

### R8. CSV export preserves spreadsheet formulas

**Code-confirmed; the exact helper was executed with the harmless input `=1+1`, which was exported unchanged.** A member-controlled display name flows into the admin CSV. Quoting commas/quotes does not ensure that a spreadsheet treats the value as text. No spreadsheet application or payload causing external requests was executed.

Evidence: `src/routes/_authenticated/_shell/admin.analytics.tsx:28`, export at line 96. See [OWASP CSV injection](https://community.owasp.org/attacks/CSV_Injection) for the distinction between CSV escaping and formula handling.

Fix: export untrusted fields as explicit text, preferably in a format that supports cell types. If retaining CSV, neutralize formula-leading characters/control characters and validate the intended spreadsheet import/save/reopen behavior. Include adversarial names in export tests.

### R9. Admin analytics and member export can silently report partial totals

**Code-confirmed.** Analytics requests cap workout/food rows at 5,000 and XP/PV rows at 10,000, then calculate totals on those subsets. The REST service can impose an earlier cap. Only the profile-request error is checked; failure of another request becomes zero/empty data. Member management also loads an unpaginated roster and filters it locally.

Evidence: `src/routes/_authenticated/_shell/admin.analytics.tsx:47`, lines 51–54; `admin.members.tsx` roster query. This finding concerns the admin dashboard/export; the member XP/PV aggregate views already used elsewhere avoid the same ledger-total problem.

Fix: database aggregates or suitable RLS-aware summary views for totals; explicit pagination/server-side search for member lists; fail visibly on any required source error. Distinguish unavailable data from a measured zero.

### R12. Strength-trend days use UTC while rewards/streaks use Cairo

**Code-confirmed.** `dailyBest()` groups sets with `created_at.slice(0,10)`. For example, `2026-10-25T22:30:00Z` falls on 26 October in Cairo but is plotted under 25 October. Other pages use device-local dates, while reward eligibility explicitly uses Cairo time.

Evidence: `src/lib/records.ts:28`; nutrition/photo date construction in their components.

Fix: one documented date policy and shared date helpers for daily charts, logs and rewards. Use explicit time zones and test midnight, travel and Cairo daylight-saving transitions. Recompute the current day when the app stays open across midnight.

### R13. Older progress photos become inaccessible through the comparison UI

**Code-confirmed.** The gallery fetches only the latest 30 photos and passes that same list to comparison. There is no older-history paging. Three poses each week can push the first month out of the available list before the end of month three. Query failures also fall through to the same empty-gallery presentation.

Evidence: `src/components/progress-photos.tsx:37` and its `PhotoComparison` input.

Fix: paginated/date-filtered history and separate comparison-photo selection; persistent query error/retry state. Fetch signed URLs only for the selected page/photos and renew them when required.

### R14. Upload formats and backup formats disagree

**Code-confirmed with live bucket configuration.** Progress uploads accept any `image/*` MIME and upload the original file. The live private bucket has a 10 MiB limit but `allowed_mime_types=null`. The backup exporter only accepts JPEG, PNG and WebP and rejects the whole backup when any downloaded object's MIME is outside that enum. An accepted GIF/HEIC/SVG photo can therefore prevent complete export. A raw unsupported image may also fail to render on some browsers.

Evidence: `src/components/progress-photos.tsx:51`; MIME parsing in `src/lib/personal-backup.ts` inside `createPersonalBackup()`. Avatar uploads already normalize through a canvas; progress uploads do not.

Fix: select supported formats, normalize progress images before upload, and align client validation, bucket restrictions, restore validation and backup export. Strip unnecessary image metadata during normalization. Handle already-stored formats with explicit conversion or a complete export path; never silently omit them. Supabase supports [bucket MIME and size restrictions](https://supabase.com/docs/guides/storage/buckets/creating-buckets).

## P2: reliability/privacy risks needing targeted browser tests

### R10. Session changes do not consistently clear private query caches

**Code-confirmed missing cleanup; cross-account browser disclosure not reproduced in this review.** The shell's sign-out helper clears the QueryClient, but Profile calls `supabase.auth.signOut()` directly. The root `SIGNED_OUT` listener invalidates the router without clearing query data. Administrative query keys such as `admin-members`, `admin-analytics`, `admin-audit` and `invites` are not scoped to the current user. Several route components render until `me` resolves rather than waiting for permission confirmation.

Evidence: `src/routes/__root.tsx:142`; `profile.tsx:330`; `admin.members.tsx:39`, line 55; corresponding analytics/invite components.

Risk: stale data can survive profile sign-out, cross-tab sign-out or an identity/role change, then be reused during a later render. The backend still applies RLS; this concern is retained client data and render timing.

Fix/test: centralize session-boundary cleanup for every sign-out/identity change, cancel in-flight work, scope private queries by identity and fail closed while authorization loads. Preserve/export unsynced drafts deliberately rather than deleting them without notice. Test two identities on a shared browser, cross-tab sign-out, role revocation and slow/failed permission requests.

### R11. Reward redemption lacks a stable retry identity

**Code-confirmed missing client idempotency; lost-response/double-action UI flow not reproduced here.** The client inserts a redemption without a stable request ID and leaves the button enabled during the request. If an accepted response is lost, retrying generates another redemption/debit. Server balance and stock locking prevent overspending available PV/stock, but do not identify a duplicate user intent.

Evidence: `src/routes/_authenticated/_shell/rewards.tsx:129`, button at line 351; redemption triggers in `20261023211916_6374a090-148f-49b3-b9ca-9bdf99aca309.sql`.

Fix/test: stable per-intent UUID/idempotency key, pending UI and explicit reconciliation after an uncertain response. Support intentional repeated purchases separately. Inject a lost response after acceptance and verify one pending request and one debit after retry.

## Security configuration and deployment improvements

- **Enable leaked-password protection if supported by the selected Auth plan.** The live Security Advisor still reports it disabled. Verify the server password policy as well as UI checks. [Supabase password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- **Add administrator MFA and enforce assurance server-side.** No enrollment/challenge flow or `aal2` requirement was found in application authorization. A UI-only prompt is insufficient. Plan recovery before enforcement. [Supabase MFA guidance](https://supabase.com/docs/guides/auth/auth-mfa).
- **Configure/test hosting response headers.** A GET of the local production `/auth` route returned no CSP, frame protection, nosniff or Referrer-Policy headers. Define them in the server or hosting proxy; apply HSTS at the HTTPS production origin. Production proxy headers were not inspected because no deployed app origin was supplied. CSP must accommodate the framework's scripts, storage images and service worker.
- **Verify real Auth delivery/settings before launch.** Real SMTP/invitation/confirmation/reset delivery, redirect allowlists, server abuse limits and CAPTCHA configuration remain separate acceptance work. Their hosted settings were not available through the connected tools. The app's cooldown is a UI convenience.
- **Preserve the current private-storage and RLS baseline.** Live checks found zero public tables without RLS, zero client-callable public security-definer functions and a private progress-photo bucket. Those checks do not catch application-specific policy mistakes such as R1/R2.
- **Keep the receipt table closed.** Its RLS-with-no-policy INFO is expected for an internal-only table. The 21 unused-index INFO findings are review items; do not remove FK/application indexes solely because of zero scans. Performance Advisor reported no WARN findings.

## Improvements and features after the fixes

| Priority | Addition                              | Concrete outcome / acceptance                                                                                                                                                                                                                        |
| -------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next     | Reliable invitations                  | The current create-invite action adds an allowlist row; it does not send an invitation email. Provide a clearly labeled copyable signup link first, then tracked email delivery, expiry/revoke state and resend. Verify using real invited accounts. |
| Next     | Coach weekly check-ins                | Private adherence/recovery feedback and a follow-up queue for assigned coaches. Surface missed planned sessions rather than equating every rest day with failure. Keep Pod sharing opt-in.                                                           |
| Next     | Editable completed workout history    | Correct mistakes through a defined workflow with ownership checks and an audit trail. Keep reward receipts immutable and explain whether corrections affect displayed PRs.                                                                           |
| Next     | Offline nutrition queue               | Stable IDs, persistent pending/error states and idempotent reconnect behavior for meals/water, using the workout sync principles already established. No unsaved-success feedback.                                                                   |
| Next     | Data deletion and device controls     | Member-visible deletion/request workflow covering Storage objects, local drafts, account/session state and a documented retention policy. Export already exists; pair it with a reliable deletion/recovery process.                                  |
| Later    | Rank-earned cosmetics and milestones  | Earned frames, banners, titles and cosmetic shop items while preserving the six base rank ranges and million-XP curve. Keep XP and PV separate; buying a cosmetic must not buy a rank. Add an inventory/equip preview and explicit unlock rules.     |
| Later    | Opt-in reminders and weekly summaries | Planned-day training reminders, a weekly progress recap and configurable quiet hours; delivery/retry state and frequency limits. Measure useful returns and completed plans, not notification opens alone.                                           |
| Later    | Mobile/accessibility polish           | Persistent errors/loading states on older admin pages; accessible labels for body inputs; reuse password controls on Profile; Arabic numeral/date entry checks; physical iOS/Android install, camera, share, audio and haptic acceptance.            |

## Suggested patch order

1. R1/R2 database authorization boundaries, plus owner-account protection. Add negative permission tests that fail on this snapshot.
2. R3/R4 membership access and atomic coach reassignment. Preserve offline/restore behavior through the permission changes.
3. R7/R14 photo lifecycle and backup compatibility; R10 session cleanup tests; password/MFA hardening.
4. R8/R9 exports/analytics; R6/R5 data validation and historical metadata.
5. R11/R12/R13 retry identities, consistent dates and complete photo history.
6. Then invitation delivery, coaching check-ins, offline nutrition and cosmetic progression.

Use new migrations rather than rewriting applied migration history. For each database change, run permission/restore/progression tests and performance/FK checks. Add failure-injection and concurrency tests where they prove an actual guarantee; passing old policy-equivalence tests alone is insufficient when the old behavior contains a vulnerability.

## Verification performed during this review

| Check                              | Result                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Review-only isolated reproductions | Six findings reproduced, including both P1 issues                                            |
| Unit tests                         | 49 passed                                                                                    |
| Database member/privacy checks     | 24 assertions; all 19 migrations applied                                                     |
| Progression checks                 | 44 assertions passed                                                                         |
| Reliability checks                 | 42 assertions passed                                                                         |
| Performance/access checks          | 720 before/after comparisons passed                                                          |
| TypeScript                         | Passed                                                                                       |
| `npm audit --json`                 | Zero reported vulnerabilities for the installed dependency tree                              |
| Live security/performance advisers | Existing leaked-password WARN; private-table/unused-index INFO findings; no performance WARN |
| CSV helper                         | Harmless formula exported unchanged                                                          |
| Local production response headers  | Missing the hardening headers described above                                                |

Existing tests passing does not contradict the new findings: their assertions do not cover these attack/failure paths. The full browser suite was not rerun for this documentation-only review; recent browser results from the XP implementation are not presented as new security coverage. Physical devices, real inbox delivery, production-proxy configuration, multi-connection load/concurrency tests and an independent penetration test remain outside this review's verified scope. Dependency audit results do not establish application security.
