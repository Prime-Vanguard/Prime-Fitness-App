# Phase 3 and 4 enhancements — 11 November 2026

Implemented locally after approval of the follow-up improvement list. This extends
the Stitch refactor; it does not declare pixel-equivalence or device acceptance.
No staging, commit, push, deployment or hosted database mutation was performed.

## Phase 3

- Today uses a compact media fallback instead of a large empty image. Calendar
  assignments distinguish upcoming sessions from due/in-progress work; a confirmed
  absent assignment explains asking the coach while keeping free training available.
- Recent food choices appear directly in entry methods. Cached recent foods remain
  available through the existing member-scoped seven-day storage when offline.
  Different macros under the same food name are not silently treated as identical.
- Explicit metric servings such as `100 g` or `250 ml` support amount entry as well
  as serving multipliers. Arabic numerals are accepted. Cups, scoops, ounces and
  ambiguous labels do not acquire guessed conversions or density assumptions.
- Food rows distinguish synced, saved-on-device and review-needed states. The week
  strip marks logged food, pending changes and unavailable dates. Unloaded history
  is not represented as an empty day. Detailed recovery remains available.
- Profile crops support drag, pinch and Reset alongside native keyboard-accessible
  sliders. The vertical scrolling layout keeps the image from overlapping controls
  on short viewports. Cropping remains local until upload confirmation.

### Reviewed meal copying

The old immediate whole-day copy action is replaced with **Copy a previous meal**
on Nutrition. Choose a source date/meal, preview entries, exclude individual foods
and adjust a shared portion multiplier before confirming. The destination is the
selected nutrition date and meal, shown explicitly in review.

Confirmation persists a scoped request before sending. Each copied food gets a
fresh UUID; retries keep the same UUIDs and frozen values. Online copies use one
bulk insert with conflict-ignore behavior. Offline copies enter one transactional
member queue group, and its recovery reference is cleared in that transaction.
Interrupted confirmation remains reviewable after refresh. Reopening Nutrition
offers reconciliation; closing review does not cancel a possibly accepted write.
No new reward path or earning rate is introduced.

Backups validate and merge saved-copy recovery with ownership checks. Restore
refuses conflicting pending requests; already-retained queued identities are not
queued again. Device-data removal is blocked while a copy is unconfirmed, with a
link to Nutrition. Existing version-1/version-2 backup compatibility remains.

Limits: at most 50 food entries per copy; native copies require a connection.
Offline sources are limited to records present on the device. Source data is a
review snapshot: later edits to the original meal do not alter a confirmed copy.

## Phase 4

- Strength puts exercise selection and period chips first, with search and load
  convention under More strength filters. Existing PR calculations and all-time
  records remain separate from the selected chart period.
- Strength and body measurements show neutral differences between actual recorded
  dates. Missing fields are not inferred; no weight-loss success classification is
  added. Body-fat differences use percentage points, distinct from relative change.
- Shop, Community and Activity use a compact wallet strip; Journey retains the full
  rank treatment. The roadmap opens around the current level, offers Jump to my
  level, and shows the next actual rank's authoritative XP requirement.
- A muscle breakdown orders groups by working sets and keeps external-load volume
  and timed seconds separate. It is not a recovery or readiness diagnosis.
- Community has URL-backed Pods, Friends, Challenges and Leaderboard subviews.
  Switching subviews preserves unfinished forms. Inactive social/Pod/leaderboard
  queries do not keep polling; privacy, opt-in, blocking and eligibility stay with
  existing guarded operations. Challenge drafts are not newly promised to survive
  a page reload before a creation request has been confirmed.
- Shop supports name, affordable and in-stock filters, clear-filter recovery and
  Cairo-dated fulfillment history. Actual stock/cost and durable redemption review
  remain authoritative. No new reward categories, product photos or delivery claims
  were fabricated; those require approved catalogue metadata/assets.
- Muscle suggestions recognize reviewed stable reference IDs and exact aliases,
  prioritizing program/recent selections and explaining their context. Archive,
  equipment and logging-mode filters still apply. No popularity claims or automatic
  exercise substitutions are made.

## Verification and remaining acceptance

Commands include unit tests, `npm run test:meal-copy`, photo-privacy checks,
TypeScript, targeted ESLint/format checks, Node/Pages builds and production-browser
checks. The isolated database test replays repository migrations and verifies copy
identity, reward parity, atomic validation, unrelated-member isolation and paused
membership. It does not prove hosted/repository migration parity.

Browser fixtures cover English/Arabic, narrow screens, metric servings, recent
foods, Community draft preservation/Back navigation, offline copy/reload/sync,
lost-response reconciliation, backup recovery, crop drag/pinch/reset and keyboard
roadmap navigation. Synthetic captures include `artifacts/phase34-food-entry-*.png`,
`phase34-meal-copy.png`, `phase34-community-*.png` and refreshed phase-3/phase-4
captures. Private accounts, actual member photos and credentials were not used.

Physical iOS/Android camera and installed-PWA testing, assistive-technology review
and controlled Stitch overlay acceptance remain pending. No schema change, hosted
configuration or new API credential is required for these enhancements.

Verification results: 418 unit tests across 65 files passed, including recovery
validation and conflict handling. Seven meal-copy database assertions and fifteen
photo-privacy assertions passed. Twenty-four production-browser cases passed for
the affected flows, and six Pages smoke cases passed. Builds, TypeScript, targeted
ESLint and formatting passed. Screenshot review also prompted a final RTL change
to isolate each macro value/unit; that presentation is checked separately in EN/AR.
The localhost preview returned HTTP 200. No hosted migration parity claim is made.
