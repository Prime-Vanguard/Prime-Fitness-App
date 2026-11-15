# Phase 6: keyboard, zoom and browser compatibility

11 November 2026. Local and uncommitted; synthetic accounts only.

## Confirmed fixes

### Return keyboard focus after closing controlled overlays

The new regression test reproduced a focus loss in both languages: opening a PV
editor with Enter and closing with Escape left the initiating action unfocused.
Controlled sheets do not always have a Radix Trigger to restore focus to.

Added `useOverlayFocusReturn` to shared Sheet and Dialog content. It records the
actual initiating element, preserves caller-provided autofocus callbacks and
restores focus on close when that element remains connected, visible and enabled.
Explicitly prevented callbacks remain authoritative. Stale, hidden/inert,
disabled or disconnected route/account controls are not focused.

Keyboard tests now traverse forward and backward within the modal, verify
initial heading focus and confirm Escape restores the originating action.
Existing review drafts and save/permission/retry behavior are unchanged.

### Keep selection indicators aligned under scaling

Indicator geometry now converts measured screen rectangles to layout pixels
before applying inline offsets and sizes. This accounts for CSS zoom and scaled
overlay ancestors. Tests exercise selection changes at 150% and 200% CSS zoom,
resize, scrolling, Arabic RTL, Radix Home/End navigation and reduced motion.

CSS zoom is an automated scaling check, not certification of native browser zoom
or all platform text-size/accessibility settings.

## Verification

| Engine            | Successful scenarios | Scope                                                                                                                                         |
| ----------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome            | 12                   | Focus return/tab containment, two editor layouts, shared sliders, 30-route matrix, crop/upload, meal-copy recovery and PV review restrictions |
| Firefox           | 8                    | Focus return/tab containment, two editor layouts, shared sliders and 30-route matrix                                                          |
| WebKit on Windows | 8                    | Focus return/tab containment, two editor layouts, shared sliders and 30-route matrix                                                          |

Each matrix includes 30 routes, eight viewports and both languages: 480 width
measurements per engine, **1,440 total**, with no document-level horizontal
overflow. The detailed route/size list is in [the responsive review](phase6-responsive-review.md).
Editor tests also cover phone, tablet, desktop and 640 × 360 landscape bounds,
plus review-note retention through resizing, close and reopen.

Node/Pages builds, TypeScript, targeted ESLint, formatting and whitespace checks
passed. No runtime dependency, schema, auth, permission, reward or storage changes.

## Repeatable local cross-browser setup

Added an opt-in `playwright.cross-browser.config.ts`. The existing Chrome/CI
configuration stays unchanged. Browser binaries are downloaded under ignored
`artifacts/browser-cache`, not committed to the repository.

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD 'artifacts/browser-cache'
npx playwright install firefox webkit
npm run build
npx playwright test --config=playwright.cross-browser.config.ts e2e/member-experience.spec.ts --grep 'staff editor Escape restores|shared switcher motion|responsive Pod and claim editors|responsive member and staff route matrix'
```

The compatibility config blocks service workers to keep synthetic API requests
intercepted, following [Playwright's network-testing guidance](https://playwright.dev/docs/network#missing-network-events-and-service-workers).
Installed-PWA and offline/service-worker verification remain separate; this does
not disable the application's service worker or change the normal test config.

The initial sandboxed Firefox runs crashed before page creation and passed when
run outside the process sandbox. Initial WebKit runs also revealed service-worker
fetches bypassing fixture interception. The isolated config corrected that test
harness issue; final WebKit tests passed. These early logs are not successful
application acceptance evidence.

## Evidence

- `artifacts/phase6-accessibility-browser.log`: 10 successful Chrome workflow cases.
- `artifacts/phase6-accessibility-matrix.log`: two successful Chrome matrices.
- `artifacts/phase6-firefox.log`: eight successful Firefox scenarios.
- `artifacts/phase6-webkit.log`: six successful WebKit keyboard/editor/slider cases.
- `artifacts/phase6-webkit-matrix.log`: two successful WebKit matrices.
- `artifacts/phase6-responsive-{en,ar}.json`: Chrome measurements.
- `artifacts/phase6-responsive-{en,ar}-desktop-{firefox,webkit}.json`: engine-specific measurements.
- `artifacts/phase6-focus-baseline-browser.log`: reproduced pre-fix focus loss.
- `artifacts/phase6-cross-browser*.log`: earlier diagnostic runs; see final logs above.

## Remaining gates

This is not a WCAG 2.2 AA certification or a complete screen-reader audit. Physical
iOS/Android, installed-PWA recovery, native zoom/text scaling, platform keyboards,
camera/media playback and safe-area behavior remain open. Windows WebKit is not a
physical Safari/iOS run. Controlled Stitch overlays and human task-usability
comparisons are still required before closing the visual acceptance gate.

Next: controlled visual comparisons and the remaining accessibility/device
acceptance checklist, followed by the approved pilot. No commit, push or deployment.
