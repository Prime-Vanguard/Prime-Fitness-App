# Phase 6: responsive staff and application checkpoint

11 November 2026. Local and uncommitted. Synthetic accounts only.

## Changes

- Pod directory and PV claim queue now use semantic desktop tables and phone
  cards. Both layouts share the existing editor actions, filtering and page slice.
  Table containers allow keyboard focus and contain horizontal scrolling on
  narrower tablets. No new reads or write paths were added.
- Staff pages use a bounded 1,440 px canvas; member pages retain their 1,200 px
  reading width. The existing phone header, tablet rail and desktop sidebar remain.
- Fixed a confirmed claim-card overflow: flex children containing long unbroken
  task titles/names could widen a 320 px page. Explicit width bounds and anywhere
  text wrapping now constrain the cards and desktop text cells. Pod pagination
  wraps its controls on narrow screens.
- Comments document responsive layout, shared actions and text-width ownership.
  Permissions, reward receipts, request identities and draft lifecycles remain.

## Responsive evidence

The browser matrix passed **480 document-width checks**: 30 routes × eight
viewports × English/Arabic. Every checked document stayed within its viewport
with a one-pixel rounding allowance. Long unbroken Pod/task labels were included;
analytics uses a populated synthetic snapshot. Queries with loading states are
allowed to settle before measurements.

| Width × height | Representative use                    |
| -------------- | ------------------------------------- |
| 320 × 740      | Narrow phone                          |
| 390 × 844      | Current phone                         |
| 640 × 480      | Short landscape / small tablet        |
| 768 × 1024     | Tablet breakpoint                     |
| 820 × 1180     | Tablet portrait                       |
| 1024 × 768     | Sidebar breakpoint / landscape tablet |
| 1280 × 800     | Laptop                                |
| 1920 × 1080    | Desktop monitor                       |

Routes include Today; Train workout/program/history/cardio; Nutrition; Progress
overview/strength/body/photos; Rewards overview/shop/journey/community; Profile
account/preferences/offline/privacy; member roster; and all nine admin routes,
including separate PV tasks and shop catalogue views. This checks those rendered
states, not every possible record, dialog, account status or workflow.

Pod and claim editors additionally passed containment checks at 320 × 740,
640 × 360, 768 × 1024, 1280 × 800 and 1920 × 1080 in both languages: **20 drawer
geometry checks**. Keyboard Enter opens the existing editor and focuses its
heading; Escape closes it. A review-note draft survives resize, close and reopen.
These tests use reduced motion so intermediate slide frames are not mistaken for
incorrect final bounds.

## Verification and findings

Nine distinct browser scenarios passed across the final workflow run and focused
reruns: two route matrices, two editor/resizing cases, complete Pod roster counts,
stable creation/stale roster review, unavailable Pod reads/draft retention,
complete claim search/reward retry and PV role/self-review restrictions.

The first matrix found and reproduced the mobile long-title overflow. Subsequent
harness corrections supplied an explicit cardio-history response and scoped a
readiness assertion to one of several claims for the same task. Those fixture
corrections did not require changing application behavior.

Node and GitHub Pages production builds, TypeScript, targeted ESLint, formatting
and whitespace checks passed. Pages prepared 20 static routes and checked 197
public output files. No database migration or backend change was needed.

Evidence under `artifacts/`:

- `phase6-responsive-en.json` and `phase6-responsive-ar.json`: 240 route/viewport
  measurements each; no private record payloads.
- `phase6-responsive-matrix-browser.log`: final matrix results.
- `phase6-responsive-complete-browser.log`: seven passing editor/workflow cases;
  its matrix failures precede the final fixture corrections.
- `phase6-responsive-editors-browser.log`: final editor/capture rerun.
- `phase6-pod-directory-*.png`, `phase6-claim-queue-*.png` and
  `phase6-claim-landscape-*.png`: synthetic captures. The Arabic desktop claim table
  and English landscape editor were visually inspected.

## Remaining acceptance work

This is Chromium viewport evidence, not a guarantee for every physical screen.
Physical iOS/Android keyboards, browser chrome/safe areas, camera, installed-PWA
behavior, browser zoom/text scaling, Safari/Firefox and screen-reader testing
remain open. A missing document scrollbar does not alone prove that every element
is unclipped or that every task is usable. Full keyboard/focus-order and controlled
Stitch overlay comparisons remain separate gates.

Next: the remaining cross-browser/accessibility and controlled fidelity review,
then Phase 7 physical-device and pilot acceptance. No commit, push or deployment.
