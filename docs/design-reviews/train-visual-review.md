# Train visual review — 10 November 2026

The local redesign is still under review. No screen is declared fully 1:1 accepted
by this report. Changes remain uncommitted and undeployed.

## Cardio reference comparison

Source: `design/stitch_prime_fitness_tracker_app/cardio_hiit_prime_fitness/`.
The source HTML and PNG were inspected. Synthetic application captures use a
390 × 844 CSS viewport with 45-second work, 15-second rest, 12 rounds and no
preparation. English and Arabic captures are available locally.

[Open the side-by-side and opacity-overlay review](../../artifacts/cardio-stitch-review.html).
This ignored artifact needs the local design folder and screenshot files. Its
image loading, capture selector and opacity control were checked in Chrome.

The reference PNG is 558 × 1600. Its original CSS viewport/device scale are not
recorded. The comparison normalizes image widths to 390 px; it is a review aid,
not a controlled pixel-equivalence test. Content and state differences prevent a
meaningful numerical similarity score.

### Corrections made

- Removed duplicated Train navigation from the dedicated Cardio destination;
  added a labeled return action. Workout, My Program and History retain their
  consistent switcher when back in Train.
- Matched the primary composition: clock, protocol, compact recorded-activity
  summary, gold action. The eyebrow uses the brand accent.
- Reduced the protocol to four main tiles. Preparation remains a smaller
  labeled setting; actual inputs and minimum touch sizes stay accessible.
- Moved detailed charts, history, cache information, retry and recovery export
  into a secondary History & sync disclosure. Progress keeps its full presentation.
- Kept review-needed queue issues visible on the main screen. Review opens the
  disclosure; it does not silently retry or choose a conflict resolution.
- Saving a steady-state record opens history. Editing closes history, selects the
  logging view and focuses its form. Native disclosure state does not own records,
  filters, revisions or the interval timer.

### Explicit source differences

| Difference                                                  | Reason / remaining work                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Reference says 24:00 for 12 × 45s work / 15s rest           | Existing timing rules give 11:45 with no final rest. Keep the correct calculation.         |
| Reference shows a running work interval with a Start action | Ready preview and actual running/paused state remain distinct.                             |
| Named tactical protocol, zones and target heart rate        | These are example claims without configured member data; they are not copied.              |
| 45/90-minute weekly progress                                | No weekly goal exists in this feature. Show recorded minutes and pending-entry context.    |
| Broken logo and alternate shell controls                    | Retain actual branded assets and existing role-aware shell navigation.                     |
| Editable inputs, preparation and recovery tools             | Preserve existing behavior in compact settings or secondary controls.                      |
| Arabic Cardio screenshot                                    | No matching Arabic source exists; check RTL readability without claiming reference parity. |

## Train acceptance register

| Screen                                     | Current evidence                                                                  | Still open                                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Cardio / HIIT                              | New EN/AR reference-configuration captures and reviewed overlay                   | Original viewport metadata, equivalent source state, final visual acceptance, physical keyboard/audio/background checks |
| Active workout                             | Refreshed EN/AR captures and passing draft/offline/touch checks                   | Source-matched overlay and member comprehension review                                                                  |
| My Program                                 | Refreshed EN/AR captures; frozen targets remain intact                            | Source-matched overlay and narrow-screen long-content review                                                            |
| History detail                             | Refreshed synthetic capture; full-set history and on-demand media checks pass     | Source-equivalent content and overlay                                                                                   |
| Finish review                              | Refreshed capture; offline retry identities and completion checks pass            | Source-equivalent content and overlay                                                                                   |
| Picker / advanced configuration / guidance | Earlier captures and recovery checks are documented in the implementation tracker | Fresh source-matched overlay pass; do not treat earlier images as fresh evidence from this pass                         |

Physical-device acceptance cannot be inferred from desktop Chrome emulation.
Next visual work is the remaining source-matched Train comparisons before calling
Phase 2 visually complete. Today/Nutrition remains the following implementation
phase; it has not been started by this pass.
