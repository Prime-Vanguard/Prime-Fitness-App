# Phase 6: staff navigation and roster checkpoint

Latest continuation: the [desktop review pane](stitch-review-pane.md) now keeps
the queue available beside a non-modal editor at desktop widths, with the
existing sheet on smaller screens. Equivalent-state calibrated captures and
EN/AR Chrome/WebKit checks cover focus, resizing, drafts and reviewed operations.
Earlier notes below remain checkpoint history; final 1:1 acceptance is still open.

November 12 continuation: controlled reference/baseline/current comparisons now
cover the staff roster, Pods and review overview, plus member Train/Profile.
See the [Stitch comparison review](stitch-comparison-review.md) for calibration,
remaining gaps and evidence. Staff navigation order, toolbar, gutters and roster
composition were corrected. No screen has final visual acceptance; the review
editor needs an equivalent-state comparison. The latest staff-shell changes have
Chrome regression coverage; prior Firefox/WebKit results predate those changes.

11 November 2026. Local and uncommitted.

The supplied `staff_members_list_prime_fitness/screen.png` guides the hierarchy:
workspace heading, roster summary, filters and member records. Its invented live
presence, clinical pause reasons, facility identity and saturation metrics are not
application facts and have not been copied.

## Implemented

- Existing admin links are grouped into People, Training, Rewards & reviews and
  Analytics in the shared navigation. All remain inside the admin role gate.
- The admin roster has total-member, active-access and matching-filter tiles.
  These use the complete authorized roster, not its displayed page. Failed reads
  show unavailable values. No extra queries were introduced.
- The coach/pod-leader roster has a People workspace heading and grouped filter
  surface. Its existing relationship scope and private-read restrictions remain.
- Comments explain the presentation/permission boundary and the count semantics.

## Verification

Node production build, TypeScript, targeted ESLint, formatting and whitespace
checks passed. Six targeted browser scenarios passed: coach private-read and
former-coach restrictions, roster reads beyond REST caps, reviewed reassignment
retry, account isolation, complete admin roster pagination and reviewed numeric
targets. The roster test also checks complete totals while filtering.

The final roster layout check covers 320px and 1280px overflow and records a
synthetic capture at `artifacts/phase6-roster-en.png`. This is not full visual or
role-matrix acceptance. No schema, authorization, storage or reward behavior changed.

## Next

1. Separate desktop roster overview from reviewed access/role/coach editing, using
   the existing review operations and draft safeguards.
2. Refine member-detail sections and coach/pod-leader mobile summaries.
3. Continue through program/exercise editors, Pods, review queues, shop and analytics.
4. Complete EN/AR, accessibility, exact-reference and device acceptance before release.

Phase 5's local presentation is recorded separately. Its manual acceptance gates
remain open; this staff checkpoint does not declare them complete.

## Contextual member editing

The admin roster now uses a semantic desktop table and mobile summary cards.
Both provide a Manage member action opening the existing responsive editor drawer.
Access, role and coach operations reuse the original review callbacks and guarded
write functions. The editor closes while the confirmation sheet is open; cancelling
or completing review returns to confirmed member values. Selection is independent
of roster filters, so a reviewed change is not lost merely because it changes a
member's filter eligibility. No new queries, schema or authorization rules were added.

Testing exposed success toasts intercepting the mobile Menu button after saves.
The root toaster now uses a safe-area-aware mobile offset below the header.

Final verification: five production-browser scenarios passed for EN/AR desktop
overview/mobile drawer, cancellation, delayed/failed coach reassignment retry,
complete roster pagination, denied access writes and accepted role/filter changes.
Two additional existing EN/AR member-control alignment scenarios passed. Existing
assertions were scoped to the roster because toast notifications also contain
list items. Node build, TypeScript, targeted lint and formatting passed; the Pages
build is recorded in `artifacts/phase6-editor-pages-build.log`.

Reviewed synthetic captures: `artifacts/phase6-member-editor-en.png` and `-ar.png`.
Captures wait for drawer entrance completion rather than recording a transition.
Full pixel-reference, role-matrix, accessibility and device acceptance remain open.

Next implementation: member-detail composition and coach/pod-leader mobile roster
summaries, followed by the remaining staff editors and review workspaces.

## Member overview and mobile summaries

The coach member view now has an identity header, segmented sections and a
two-column desktop overview: the existing seven-day completion summary alongside
navigation to training, nutrition, check-ins and photos. It introduces no new
metrics or private-data prefetch. The supplied staff member-detail image guides
the composition; unsupported vitals, clinical assessments, coach-note fields,
live presence and management actions were not introduced.

Coach/pod-leader rosters now use compact mobile cards and retain the desktop
table. Both consume the same visible-page summary queries. Pod-only members
still have no private-detail link. Missing summaries remain unavailable, and
rank text uses bidirectional isolation for Arabic.

Six targeted browser scenarios passed: EN/AR pod-only mobile scope/320px layout,
deferred private reads/former-coach denial, complete roster data with mobile and
desktop views, per-slot coach policies and frozen history labels. A focused
overview-navigation rerun also passed. TypeScript, Node/Pages builds and targeted
lint passed before the final text-encoding refinement, which receives a focused
mobile capture rerun. Synthetic captures use the `phase6-pod-summary-*` and
`phase6-member-overview.png` names under artifacts.

Next implementation is the program/exercise editor presentation, then Pods,
review queues, shop and analytics. Full accessibility, physical devices and exact
reference acceptance remain open. This work is local and uncommitted.

Final refinement: both EN/AR mobile summary capture checks passed, and the Node
production build and targeted lint passed again.

## Program and exercise editor presentation

Inspected `staff_programs_builder_prime_fitness/screen.png` and
`staff_exercises_library_prime_fitness/screen.png`. Added Training workspace
headings, grouped search surfaces and reusable summary tiles using complete
already-loaded records. Catalogue totals and reviewed guidance are distinct;
media availability does not imply editorial approval. Program exercise-library
data remains deferred until a program is selected. Incomplete reads stay
unavailable rather than displaying zero.

Program builder navigation and exercise-editor sections now use segmented
controls. Session selection and exercise rows use inset navy surfaces. The
selected draft session shows exercise and prescribed-set totals. Publishing and
assignment remain separate reviewed operations; hidden editors retain drafts.
Comments explain these data and workflow boundaries.

Five production-browser scenarios passed: EN/AR staff filter alignment at mobile
and desktop widths, retained row drafts/copy/publication/assignment retries,
stale-preview rejection and structured exercise edits/media/approved alternatives.
The delayed-read test explicitly verifies that session totals are unavailable
until the saved session data arrives. Node and Pages builds, TypeScript, targeted
lint, formatting and whitespace checks passed. Reviewed the synthetic Arabic
program capture at `artifacts/program-builder-ar-mobile.png`.

This is an incremental presentation pass. It does not claim exact desktop
table/drawer parity, media licensing approval, clinical classifications, automated
periodization or bulk assignment. No backend/schema/storage changes or new queries
were introduced. Next: Pod workspace, review queues, shop and analytics. Full
accessibility, controlled reference overlays and physical-device gates remain open.

## Pod management and PV review presentation

Reviewed the Stitch `staff_pods_management_prime_fitness` and
`staff_review_queue_prime_fitness` screenshots. Applied their grouped navy
surfaces and summary hierarchy using actual available records. Pod summaries
show total Pods, Pods with leaders and search matches. Claim summaries explicitly
describe the selected status, rather than claiming all-time totals. Search and
pagination do not narrow the complete-read total. Errors leave summaries unknown.
No new reads or fabricated saturation, tonnage, turnaround or live telemetry.

PV navigation is segmented. Queue cards separate member/task, submitted date,
status, staff feedback and the review action. Pod actions span each card; the
roster leadership inset remains distinct from membership changes. Evidence and
saved review feedback have separate surfaces and remain plain text. Existing
review confirmations, stale checks, role restrictions, request identity and
server award receipts are unchanged.

Eight targeted scenarios passed across the initial run and one rerun. The new
total assertion initially expected 1,005, overlooking the fixture's extra
self-review record; correcting it to 1,006 passed. Coverage includes EN/AR mobile
and desktop filters, complete roster counts, failed/retried mutations, stale
leadership/membership reviews, unavailable reads, complete claim search, approval
retry without duplicate awards and task administration. Node/Pages builds,
TypeScript and targeted lint passed. Formatting and whitespace checks passed.
Logs: `artifacts/phase6-pods-review-*`. Reviewed `admin-pods-mobile.png` and
`admin-pod-roster-ar-mobile.png`; the full-page Pod capture includes the known
fixed-navigation stitching artifact. A retained status message remains in its
creation language after a locale switch; live message translation is not added
in this presentation pass.

This is an incremental presentation checkpoint, not exact desktop table/drawer
parity or complete accessibility acceptance. Physical devices and controlled
reference overlays remain open. Next: shop/redemptions, then analytics. All work
remains local without committing, pushing or deploying.

## Shop/redemption and analytics presentation

Reviewed `staff_shop_redemptions_prime_fitness/screen.png` and
`staff_dashboard_prime_fitness/screen.png`. Implemented the supported summary,
navy-surface, segmented-navigation and table hierarchy. Catalogue totals come
from the complete existing reward read; the queue count explicitly describes
the selected status. Missing/failed reads show an em dash. No invented warehouse,
economy-velocity, stock-by-size, clinical, live-presence or cash-price data.

Desktop catalogue and fulfillment tables share reviewed actions with mobile
cards, plus identical filtering and pagination. Fulfillment displays the original
charged cost, not the reward's current price. The review drawer remains the same
guarded operation. Visibility changes retain their review, stale checks and retry
handling. Summary/permission/action comments explain these boundaries.

Analytics uses semantic metric definitions, an inset filter surface, clearer
workout-period labels, padded tables and mobile record/audit cards. Complete
snapshot totals do not change with member filters. The audit read remains opt-in
and capped at the latest 200 events. CSV export continues to use all snapshot
members, formula-safe text and a fresh authority check. No API/storage/database
contracts or additional requests introduced.

Six final production-browser scenarios passed, including EN/AR filter layout,
safe export/failure recovery, URL state/deferred audit/current authority, old
request search/refund-once retries, catalogue stock validation/uncertain receipt
recovery/stale visibility. Added assertions for complete status totals across
search and unavailable counts after failure. Desktop checks reopen a historical
request, preserve its original price, and cancel visibility review without a
write. Node/Pages builds, TypeScript, targeted lint and formatting checks passed.
Logs use `artifacts/phase6-shop-analytics-*`; reviewed
`artifacts/phase6-shop-desktop.png`, `admin-shop-catalogue.png` and
`admin-analytics-ar.png`. Mobile full-page captures may include the existing
fixed-navigation stitching artifact; the catalogue capture also shows the
keyboard-focused skip link after dialog closure. These are not controlled
pixel-comparison captures.

Next: invite/nutrition-target screens and the broader Phase 6 role, keyboard, RTL
and reference-fidelity review. Exact layout parity, full accessibility and
physical-device/pilot acceptance remain open. No commit, push or deployment.

## Invitations and nutrition-target presentation

Reviewed `staff_invite_member_dialog_prime_fitness/screen.png`. Applied the navy
access-control hierarchy to supported email/role fields and reviewed signup
eligibility. Kept the actual 14-day validity and explicit untracked delivery;
the reference's tier, name, coach/Pod allocation and token-copy controls are not
implemented product capabilities. Invitation summaries describe the complete
existing read, pending status uses the existing clock, and failed reads do not
become zero. Desktop rows/mobile cards share revocation and privilege gates.

Nutrition targets have a clear unselected state and inset member picker. Accessible
Energy & macros / Hydration fieldsets group the existing values, with saved
baselines beside inputs. The review/reload actions are separated by a divider.
Member switches preserve mounted drafts. No new queries or altered numeric,
authorization, stale-save, acknowledgement or reward behavior.

Nine scenarios passed across the initial eight passes and one corrected-selector
rerun. Coverage: EN/AR responsive controls, coach private-read scope, profile
sign-out/account isolation, target validation/Arabic numerals, member draft
switching/stale saves/lost receipts, member role/access review, complete invite
history/retry/revocation and fresh privileged-role checks. Added complete-count,
error-unavailable, desktop action and fieldset assertions. The privacy test's
initial text locator matched desktop/mobile/screen-reader copies; it now uses
the visible member heading, while retaining all no-leak assertions.

Node/Pages builds, TypeScript, targeted lint, formatting and whitespace checks
passed. Logs: `artifacts/phase6-invites-targets-*`. Inspected
`phase6-targets-desktop.png` and `admin-invitations-ar-mobile.png`. Full-page
navigation stitching is not evidence of actual content overlap. Keyboard-only,
screen-reader and controlled pixel comparisons remain outstanding.

Next is the cross-workspace Phase 6 role/keyboard/RTL/reference-fidelity sweep,
including remaining desktop Pod and review layouts. This checkpoint does not
close exact one-to-one, accessibility, physical-device or pilot gates. All changes
remain local and uncommitted.

## Shared switcher motion checkpoint

All existing `MemberSections` consumers now share a measured 200 ms sliding
surface, including member, coach and admin workspaces. Underline variants keep
their gold line; segmented variants use the raised navy surface. Exercise tabs
retain Radix keyboard/focus behavior. Custom food/date/filter/week/pose/activity/
period/muscle/rest/RPE and onboarding radio groups use the same decorative
indicator. Binary switch thumb direction is corrected for RTL. Native selects,
multi-select exercise staging and interactive rank-map nodes are not converted
to segmented controls.

The implementation follows selected DOM bounds, not assumed item widths. It
handles scrolling, wrapped groups, translated text, font loading, native radio
changes and resize, with scoped observers/cleanup and coalesced measurements.
Reduced motion disables transition. Existing disabled state, selection handlers,
draft retention and network behavior stay authoritative. No dependency or schema
change was needed.

Eleven browser scenarios passed, with final EN/AR shared-control reruns also
verifying checked binary thumbs remain inside their tracks. Coverage includes
resize/scroll geometry, Train stability, reduced motion, Radix End/Home and focus,
staff filters, offline cardio/HIIT recovery, nutrition draft preservation,
onboarding radio focus and full-catalogue options responsiveness. Node/Pages
builds, TypeScript and targeted lint/format/whitespace checks passed. Evidence:
`artifacts/switcher-motion-*`, including `switcher-tabs-ar.png`. These checks do
not close physical-device, screen-reader or controlled 1:1 comparison gates.

Next remains the Phase 6 keyboard/role/RTL/reference sweep and remaining desktop
Pod/review compositions. All work stays local, without commit, push or deployment.

## Desktop Pod/review and responsive checkpoint

Pod directory and claim queue now have semantic desktop tables and phone cards,
sharing their existing editor actions and paginated/filter data. Their scroll
regions are focusable and contain table width on tablets. Staff pages use the
planned bounded 1,440 px canvas. The responsive sweep reproduced a mobile claim
card overflow with long unbroken titles; width bounds and anywhere wrapping fix
it. Pod pagination wraps on narrow screens.

The final matrix passed 480 width checks across 30 routes/eight viewports/two
languages. Twenty drawer geometry checks verify phone, tablet, desktop and short
landscape containment; keyboard opening/heading focus and retained review notes
also passed. Existing Pod/PV workflows continue passing. Full evidence and limits
are in [the responsive review](phase6-responsive-review.md).

Node/Pages builds, TypeScript, targeted lint and formatting/whitespace checks
passed. Nine distinct browser scenarios passed across the final workflow and
focused reruns. This does not close screen-reader, physical-device, browser-zoom,
cross-browser or controlled pixel-fidelity gates. No backend/storage/authorization
or reward contract changes. All work remains local and uncommitted.

## Keyboard and browser continuation

Confirmed and fixed focus loss on Escape from controlled staff editors without a
Radix Trigger. Shared Sheet/Dialog content returns focus to the initiating control
only when it is still eligible; caller callbacks remain authoritative. Tab and
Shift+Tab containment, heading focus and Escape return pass in both languages.
Slider geometry now supports CSS zoom and scaled ancestors.

Final compatibility runs passed in Chrome, Firefox and Windows WebKit, including
1,440 route/viewport measurements across the three engines. See the
[keyboard/browser review](phase6-accessibility-browser-review.md) for precise
coverage, local setup, initial environment/mock failures and final evidence.
Normal CI/PWA behavior is unchanged. Physical devices, screen readers, native zoom
and controlled Stitch acceptance remain open. No commit, push or deployment.
