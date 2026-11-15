# Stitch Progress detail checkpoint

November 12, 2026. Local and uncommitted; no push, deployment, hosted migration or
rollout change. Phase 6 and final visual acceptance remain open.

## Reference and state coverage

The [offline comparison report](../../artifacts/stitch-comparison/review.html)
now includes three further frames: **11 of 60 references compared, 49 pending,
none finally accepted**. Each has an original PNG, pre-edit baseline, current
capture and adjustable overlay. Coverage does not mean the route is visually
approved or that every state has been tested.

| Frame           | Reference                              | CSS viewport / DPR | Controlled fixture                                                                                                                       |
| --------------- | -------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Strength        | `progress_strength_prime_fitness`      | 373 × 1600 / 1     | Two completed native, bilateral working performances at 80 and 90 kg × 8, using the same total-load convention.                          |
| Body & wellness | `progress_body_wellness_prime_fitness` | 425 × 1600 / 1     | Three dated measurements; actual weight/waist/body-fat values with no heart-rate, verified-fasted or recovery classification.            |
| Photos          | `progress_photos_prime_fitness`        | 445 × 1600 / 1     | Four clearly marked synthetic test images behind mocked signed URLs. The oldest/latest front pair is explicitly selected in both stages. |

Native PNG dimensions are used without inferred scaling. The capture clock is
fixed at November 12, 2026, 10:00 UTC. Baselines were taken from the previous
production build before applying these presentation edits and saved under
`artifacts/stitch-comparison/progress-baseline/`. The capture accepts
`PW_STITCH_STAGE='progress-baseline'` for preparing a future baseline; capture
`after` following changes, then run `node scripts/review-stitch.mjs`.

The initial photo fixture supplied rows in a different order from the requested
server ordering. Explicit before/after selection corrects the capture rather than
assuming the mock's default pair; the screenshot returns to the page top before
capture. Synthetic artwork avoids real member photos and does not reuse the
reference's model photos. Data/content differences remain disclosed.

## Presentation and usability changes

### Strength

- Grouped exercise selection, period and advanced filters with the chart. The
  selected period's latest estimated 1RM is visible beside the heading; all-time
  PRs and source evidence retain their separate meaning.
- Kept one stable filter/control tree even when a search finds no records, so
  keyboard focus and query text survive the empty-result state.
- Numeric trend data is available in an expandable section rather than a second
  always-open table. Record math, conventions, imported provenance and evidence
  links are unchanged. Non-weighted/side records remain available.

### Body & wellness

- Measurement summaries use independent cards, larger values and compact neutral
  deltas. Their date evidence remains accessible to screen readers; no direction
  is labeled medically better or worse.
- Phone history uses dated cards with the same values/statuses as the retained
  desktop table. Missing values remain an em dash, and pending/conflict/rejected
  states retain their original wording. Both presentations share the existing
  read, formatter and local mutation data.
- The existing measurement sheet retains dates, captured entry units, dirty
  values, stable write identity and lost-acknowledgement recovery. Wellness remains
  self-reported; no unsupported resting-heart-rate metric was added.

### Photos

- Direct capture and gallery upload are prominent, separate actions. Upload pose
  remains explicit. Existing normalization, durable metadata, errors and deletion
  retries keep their owners.
- Comparison is ahead of the archive. Its default is side by side, with an
  animated segmented switch to the existing overlay slider. View preference is
  held by the history controller through pair signing; switching views retains
  the slider position while the viewer stays mounted.
- Date/pose filters are secondary in a disclosure; before/after choices and
  comparison paging remain accessible. The archive uses two columns on phones,
  with existing deletion, paging and signed-image renewal controls.
- Fixed an RTL coordinate mismatch reproduced by the new Arabic test: the range
  control now uses LTR coordinates to match the image's physical reveal geometry.
  Surrounding Arabic text/layout remains RTL. Both language tests now expect
  ArrowRight to move the boundary right, from 50 to 51.
- The privacy message accurately includes the member, coach and admins. The
  reference's unsupported encrypted-vault claim is not presented as fact.

Comments explain ownership, responsive duplication, fixed geometry and data scope.
No schema, permission, reward rule, photo-signing policy or persistent format changed.

## Verification

Fifteen Chrome scenarios and six Windows WebKit scenarios passed. The Chrome run
includes 480 route-width measurements across 30 routes, eight sizes and both
languages. The Node build, TypeScript, targeted lint, formatting and whitespace
checks passed. Pages build/output verification passed: 20 static routes and
200 public files checked. The browser selection covers comparison modes and retained
measurement drafts in both languages; 30 routes/eight sizes/both languages;
measurement acknowledgement/unit changes; load conventions and zero-result search
focus; source imports; private-photo pagination, pinned pairs, failed loads and
deletion retry; keyboard comparison; offline body/nutrition and numeric validation.

Initial diagnostics reproduced the RTL range mismatch and an existing phone-table
assertion that no longer matched the new cards. The latter now checks the visible
phone history, while a separate desktop assertion verifies the retained table.
No authorization or persistence test was removed.

Evidence: `artifacts/stitch-progress-{baseline,browser,webkit,build,pages-build,types,lint,photo-checks}.log`.
The existing photo-privacy script passes 15 assertions. Browser data is mocked;
this does not certify hosted RLS or physical Safari/iOS/Android PWA behavior.

## Remaining differences and next work

Shared mobile header/navigation and typography still differ from the exports.
Strength retains existing period options, source-set review and sharing rather
than fictional PDF/1RM-test actions or unimplemented volume summaries. Body uses
its preserved measurement sheet instead of the source's inline audit form.
Photos retain actual filters, permissions and deletion/recovery controls absent
from the static design. These differences remain visible in the report; no
screen is finally accepted.

Next: controlled comparisons for active workout, exercise selection and workout
history/program states, followed by remaining staff/community/reference states.
Physical PWA, screen-reader, final fidelity and pilot gates remain open.
