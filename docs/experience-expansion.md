# Workout, scanning, cardio and social expansion

## Delivery order and findings

1. Workout UX: preserve string drafts, actual-versus-prescribed targets, secondary discard menu with identifiable confirmation and backup, configurable audible rest alert.
2. Scanning: barcode decoding and nutrition-label OCR; review before normal nutrition logging. No meal-photo calorie inference. Recognition is on-device; barcode lookups use an authenticated, rate-limited Supabase proxy.
3. Cardio/HIIT: canonical seconds/metres, durable local drafts and retry-safe records, separate progress totals. No estimated calorie claims or new XP.
4. Member codes: stable random codes, exact authenticated lookup, opt-in discovery, rate limits, no email exposure.
5. Friends/challenges: recipient-approved friendships, blocking, opt-in collaboration, server-calculated shared progress. No changes to Pod visibility or XP awards.

The plate calculator coerced empty strings to zero on every keystroke and replaced zero with 100 when reopened. It now keeps editable numeric text and applies a reviewed actual weight explicitly. Existing planned-set inputs already persist per-row drafts and keep program prescriptions immutable.

## Hosted reconciliation, 7 November 2026

Hosted history contained the first 32 repository migrations. The five already-tested pending migrations were applied through Supabase's migration API. That API assigns deployment timestamps. Automatic approval review rejected rewriting migration-history metadata, so the original hosted entries are preserved and this mapping is explicit:

| Repository version | Hosted version | Name                           |
| ------------------ | -------------- | ------------------------------ |
| 20261030151207     | 20261107134113 | admin_review_active_access     |
| 20261030153540     | 20261107134222 | reviewed_program_editor        |
| 20261030164642     | 20261107134226 | active_shop_administration     |
| 20261101144237     | 20261107134231 | reviewed_schedule_conflicts    |
| 20261101160432     | 20261107134239 | trusted_owner_provisioning     |
| 20261107133928     | 20261107142546 | cardio_social_member_discovery |
| 20261107143533     | 20261107143632 | friend_request_consent_guard   |

Do not blindly replay mapped files using CLI timestamp comparison. Match this deployment mapping and the applied SQL first. Historical local migration files were not edited. Existing owner/test accounts and roles are preserved.

Baseline: all existing functional database suites and 720 before/after policy comparisons passed in isolated Postgres. The hosted security advisor reported leaked-password protection disabled; enable that in Supabase Auth settings as an operational follow-up. Private receipt tables intentionally have RLS with no client policies.

## Provider and runtime choices

Open Food Facts product lookups require attribution and ODbL/DbCL handling. Results remain a separate, transient lookup source; reviewed values enter personal meal records through the existing editor, not a copied shared product catalogue. The proxy identifies the application, does not upload images or personal notes, and has a per-member lookup allowance. Coverage and label quality vary; missing/uncertain nutrients remain blank rather than zero. No paid API or third-party account is required.

Tesseract.js performs English/Arabic label OCR in a worker. ZXing provides a barcode fallback where native BarcodeDetector is unavailable. Runtime/language downloads are optional, hosted app assets outside critical app-shell caching. First-use OCR needs connectivity; installed recognition data can be reused. Camera denial, unsupported hardware, cancellations and unknown products have manual-entry paths. Members must review recognized values; photographs of meals are not treated as reliable macro measurements.

References: [Open Food Facts API](https://openfoodfacts.github.io/openfoodfacts-server/api/), [data licensing](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/), [Tesseract.js](https://github.com/naptha/tesseract.js), [ZXing browser](https://github.com/zxing-js/browser).

## Phase 1: workout entry and alerts

Actual entries remain separate from frozen program prescriptions. The existing string-based set editor, numeric normalization and canonical kg conversion are reused. The calculator now supports empty/decimal text and an explicit actual-weight action; zero stays zero when reopened. Planned and advanced draft writes merge changed fields into the latest IndexedDB transaction, preserving independent edits to other fields. Existing stable set identities and synchronization remain in place.

**Discard workout** is a directly visible secondary button below **Session notes & recovery**, outside the collapsible section and separated from logging controls by a divider. The confirmation names the workout and counts its logged sets. It offers a device backup export before removal; cancelling preserves the draft. The export preserves recovery data, but does not promise an automatic undo after server deletion.

Rest settings include a persistent volume slider, mute, optional vibration and a user-initiated preview. Three stronger tones replace the quiet double beep. Browser audio must first be unlocked through a gesture. Device volume, OS restrictions and background suspension still apply; physical-device audibility cannot be guaranteed by browser automation.

Verification covers blank/decimal entry, independent field merging, unchanged prescriptions, offline refresh, secondary discard/confirmation, preference persistence, tone gain and muted/blocked audio.

## Phase 2: reviewed food scanning

The existing Nutrition entry sheet contains the scanner. Barcode camera/photo decoding and manual barcode entry use the authenticated `food-barcode` Edge Function. It validates membership, rollout access, format/check digit and a 60/hour member allowance before querying the documented Open Food Facts v2 product-read contract. Anonymous calls are rejected. Only the barcode goes to the provider; images remain on-device. The response is restricted to names and four nutrients.

English/Arabic label OCR runs lazily in a worker, with cancellation and manual text/number fallback. Uncertain/missing nutrients stay blank. Members confirm food name, serving basis and every macro before values enter the normal food editor; that step does not save food. Normal logging then uses the existing durable nutrition flow, totals, custom meal and favorite paths. Barcode values require checking whether the package basis is 100 g or 100 ml.

Tesseract/ZXing runtimes and notices are prepared by npm build/development hooks. OCR core and language files remain outside service-worker precaching. A fresh device needs connectivity to download them; offline recognition is conditional on available browser storage. There are no private external API credentials or paid recognition services. Provider coverage in Egypt is variable, not guaranteed. Meal-photo macro inference is deliberately unavailable rather than presented as accurate food recognition.

Verification covers English/Arabic parsing, multiple-column refusal, missing versus zero, barcode check digits and review-before-save browser integration. Hosted QA confirmed authenticated validation and anonymous rejection without sending test product lookups to the production provider. Physical camera and OCR quality checks remain a pilot gate.

## Phase 3: cardio and HIIT

Train contains a separate Cardio & HIIT panel; Progress contains its history and seven-day chart. Activities include walking, running, cycling, rowing, elliptical, stairs and other cardio. Values use seconds/metres; distance, speed and pace display in km or miles. Incline, resistance, average heart rate and notes are optional. Strength volume and estimated 1RM are untouched.

HIIT supports preparation, work/rest periods, rounds, pause/resume and timestamp-based recovery. A final rest is excluded. Completed timers and their queued logs commit atomically, once, using a stable record ID. Phase alerts use the same rest-alert preferences. Saved HIIT duration must match the interval plan on both client and server.

Saved cardio uses the existing project/member IndexedDB namespace, with an independent revisioned queue, stable mutation receipts, deletion tombstones and Web Locks. Retries run on reconnect/focus and every 15 seconds while open. An old acknowledgement cannot erase a newer edit. Conflicts retain both versions for explicit selection; authentication changes pause foreign-member uploads. The cache retains seven days plus every pending record regardless of age. Personal backups preserve and validate this local recovery state and do not overwrite newer device records.

Online history currently covers 90 days. Personal backups include cached cardio and its pending queue; the cardio recovery export includes the currently loaded history. A complete archival export of all older server cardio records is not yet part of the personal-backup RPC. Conflicting records remain exportable and require manual review.

Calorie policy: no automatic energy estimate or food-budget adjustment without a validated activity-specific estimation model. Reward policy: cardio and HIIT award no XP/PV, badges or streak credits in this release. Native strength reward triggers and million-XP thresholds remain authoritative.

Verification covers interval boundaries, pace conversion, pause/reload behavior, atomic completion, durable pruning, ownership, late acknowledgements, revision conflicts, stale-tab timers, recovery merges and offline browser synchronization.

## Phases 4–5: codes, friendships and collaborative challenges

Rewards → Community contains the social panel, separate from Pods. Every profile receives a stable `PF-` code with 16 random hexadecimal characters and a uniqueness constraint. Exact-code discovery and requests are off by default. Lookup is authenticated, active-member-only and limited to 20/hour; it returns display name and member ID without email or other profile fields. Search codes never authenticate or invite an account.

Requests support recipient acceptance/decline, removal, blocking and unblocking. Declined requests cannot be repeatedly resent, including after sender removal or block/unblock attempts; the recipient can explicitly reopen one. A separate forward migration enforces that consent boundary. Blocks work in both lookup directions, remove friendship access and disconnect affected challenge participation. Unblocking does not recreate consent or membership. Sharing preferences wait for server acceptance and visibly revert on failure.

Shared challenges have a title, goal, dates (up to 90 days) and up to ten participants. Owners invite accepted friends; recipients explicitly join. Goals aggregate qualifying native strength workout days or active cardio minutes across consenting, active participants. Imported strength history and warm-ups do not count. HIIT contributes work seconds, excluding preparation/rest; cardio contributions are capped at 180 minutes per member/day. These are self-reported collaboration goals, not verified competitive results. Existing activity inside the date window contributes after joining.

Progress and completion are calculated by guarded server operations. Removing logs or participation can reduce progress and reopen completion; no reward is awarded. **Check completion** refreshes the server state. Leaving/opt-out removes contributions; owners can cancel. Lost creation responses reuse a durable request ID. Cancelling a saved request leaves a server cancellation tombstone so a late retry cannot recreate it.

Wellness, measurements, photos, nutrition and private session notes are never in social responses. Social actions require connectivity to recheck privacy and blocks. Public social tables deny direct client reads/writes; invoker RPCs delegate to private, guarded helpers. Initial social mutations use a shared transaction lock for correctness during the small pilot; larger rollout needs contention measurement before increasing scale.

Verification includes unrelated/assigned/former-coach reads, inactive/anonymous denial, direct-table denial, recipient-only acceptance, exact lookup/limits, blocking, challenge aggregation, cancellation retries and no cardio XP. Mobile browser checks cover opt-in discovery and friend-request submission.

## Rollout and remaining release checks

The new schema and JWT-protected Edge Function are deployed. The three feature flags are `food_scanning`, `cardio` and `social`: general enablement is false, staff enablement is true. Existing `training_pilots` membership also enables pilot access. No member discovery/sharing preferences were enabled by this work. The owner and QA account roles were preserved.

New frontend changes remain in the workspace until published. Database migration timestamps must follow the explicit mapping above; do not rewrite hosted migration metadata or replay matching SQL solely because filenames differ.

Required manual gates: physical iOS/Android camera and OCR testing; locked/background HIIT audio/vibration checks; review OFF coverage/licensing before distributing a derived shared catalogue; and pilot review of storage quotas, cross-device conflicts and social-lock contention. Leaked-password protection remains a Supabase Auth configuration follow-up: [remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

The hosted security advisor reports intentional RLS-without-policy informational notices for RPC-only tables; their client grants are revoked. The performance advisor reports unused-index information on this two-account test project. Foreign-key indexes are retained.

## Verification results, 7 November 2026

- **395 unit tests / 60 files passed.** Additional targeted checks cover the final typed RPC boundary and canonical pounds conversion.
- **All 39 migrations replayed in isolated Postgres.** The complete functional database suite passed, including 38 new expansion authorization/retry/consent checks. A full local Docker Supabase stack was not exercised.
- **95 native mobile browser tests passed**, with one optional traffic benchmark skipped. Five focused feature scenarios passed again after final changes, including a new full-record cardio conflict/resubmission check. Browser backend fixtures do not replace real-device or hosted authorization checks.
- **Four Pages browser checks passed**, including scanner worker/WASM availability under `/Prime-Fitness-App/`, scoped caching, authentication callbacks and offline nutrition recovery.
- TypeScript, production builds and compiled Pages credential/configuration scans passed. ESLint has zero errors and seven existing Fast Refresh warnings; formatting and Git whitespace checks pass.
- The historical **720 permission comparisons** and existing training benchmark passed without replacing the historical performance report. The [new experience benchmark](performance/experience-expansion-local.json) records indexed reads and shared challenge queries using 10,000 cardio records.
- Hosted QA signed in with the existing test account and checked staff flags, opt-out defaults, the cardio history RPC, anonymous scanner denial and authenticated invalid-barcode validation. No live training records or sharing preferences were changed by that smoke check.

The database types were refreshed from the hosted schema. The first-assignment `_expected` parameter retains its documented nullable override because Postgres RPC code generation cannot infer that SQL parameter nullability.
