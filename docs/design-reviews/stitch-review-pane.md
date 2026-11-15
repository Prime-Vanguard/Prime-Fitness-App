# Stitch staff review pane checkpoint

November 12, 2026. Local and uncommitted. No deployment, migration or rollout
change. Phase 6 remains in progress; this is not final 1:1 visual acceptance.

## Reference and capture calibration

Reference: `design/stitch_prime_fitness_tracker_app/staff_review_queue_prime_fitness/`.
Its PNG is 1540 × 1600. The sidebar is about 288 output pixels versus 240 CSS
pixels in the exported HTML; the toolbar is about 67 output pixels versus 56 CSS
pixels. Both suggest a **1.2× export scale**. This is an inference from two
anchors, not proof of the original browser settings.

The controlled capture now uses 1283 × 1333 CSS pixels at 1.2 DPR. Rounded output
matches the reference dimensions, as checked by `scripts/review-stitch.mjs`.
Both baseline and current captures open the same kind of synthetic, pending,
non-self claim, with its decision form ready. The baseline was taken from the
previous production build before changing the editor presentation. It is retained
under `artifacts/stitch-comparison/review-baseline/`; the original overview-only,
uncalibrated capture remains under `before/` as historical evidence.

The [offline report](../../artifacts/stitch-comparison/review.html) includes the
reference, calibrated modal baseline and current desktop pane, plus an adjustable
overlay. Evidence contains synthetic identities only. Fixture evidence includes
a literal script string to exercise plain-text rendering; it is not executable
HTML. The reference's video/form-check features are not implemented claim fields
and are not fabricated for screenshots.

## Implementation

- Added `AdminReviewFrame`, a presentation component used by `PvClaimEditor`.
  At 1280 CSS pixels and above it is an inline, non-modal dialog beside the queue.
  Smaller widths retain `AdminEditorDrawer` and its Radix focus-trapped sheet.
  Other admin editors keep their existing presentation.
- Queue and editor use the reference's 7:5 desktop column proportions. Controls
  remain on the logical trailing side in RTL. The selected row is highlighted;
  row actions remain visible while the narrow table scrolls horizontally.
- Placed real status-scoped counts beside the heading, used underlined workspace
  navigation and reduced filter padding. No all-time totals, latency or live
  telemetry are invented.
- Grouped saved task/reward/status/date facts separately from member evidence and
  editable review feedback. Evidence remains plain text; approval remains a
  reviewed operation with a separate confirmation and server receipt.
- Kept visited claim controllers mounted across workspace section changes.
  Breakpoint changes remount presentation fields while controlled notes, selected
  decisions, stale snapshots and uncertain-request identity remain in the same
  `PvClaimEditor`. No second editor controller or mutation path was introduced.
- Desktop opens focus its heading and bring the pane into view if necessary.
  Escape within the pane closes it unless a review/reload locks it. Closing
  restores a visible, enabled queue action. Switching claims does not steal
  focus back to the previous row. Portal confirmation Escape belongs to the
  confirmation, not the underlying pane.

Comments explain focus, scrolling, snapshot and controller ownership. No schema,
authorization, reward calculation or persistence format changed.

## Verification

Fourteen Chrome scenarios and six Windows WebKit scenarios passed. The Chrome
run includes 480 document-width checks across 30 routes, eight viewports and both
languages. The admin-review checks, Node build, TypeScript and targeted ESLint
passed. Pages build/output verification passed: 20 static routes and 200 public
files checked. Formatting and whitespace checks passed. Targeted checks cover:

- EN/AR non-modal queue access, side-by-side geometry and claim selection.
- Notes retained across two claims, desktop → tablet → desktop, close/reopen.
- Tablet tab containment and heading focus; desktop close/focus return.
- Confirmation dismissal preserves the pane and performs no ledger write.
- Existing review feedback, stale-edit, self-review, role/access, retry and server
  award receipt cases.
- EN/AR route-width matrices and phone/short-landscape/tablet/desktop editors.

Diagnostic runs initially exposed a real inline-pane viewport problem, corrected
with scroll-into-view on open/breakpoint change. Two new assertions also assumed
attributes/roles absent from existing components: Radix sheets trap focus without
an explicit `aria-modal` attribute, and `AdminChangeReview` uses a named dialog.
Tests now verify actual sheet containment and target the named confirmation.
These assertion corrections did not change approval behavior. Initial logs are
diagnostic evidence, not successful acceptance results.

Logs: `artifacts/stitch-review-{baseline,browser,webkit,build,pages-build,types,lint}.log`.
Admin operation checks: `artifacts/stitch-review-admin-checks.log`.
Earlier diagnostic/intermediate browser logs are retained separately. Default
Chrome/PWA configuration is unchanged. WebKit runs on Windows do not certify
physical Safari/iOS or installed Android behavior.

## Remaining work

The frame now matches the source's desktop interaction model and comparison
state. Exact typography, global header/navigation details, content and unsupported
source features still differ. Five of 60 PNG references have controlled comparison
evidence; 55 remain pending and no screen has final visual acceptance.

Next: extend comparisons to Today, Nutrition and Progress states, then the
remaining staff/member inventory. Retain physical-device, screen-reader,
installed-PWA, final fidelity and pilot release gates.
