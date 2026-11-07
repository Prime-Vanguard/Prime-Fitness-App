# Form and mobile alignment — 7 November 2026

## Findings and changes

The Train history filter used an inline label/select pair with almost no starting padding. The wider audit found 54 native selects in 30 files with different heights, padding and label gaps. Some text inputs touched their labels, and two-line labels placed adjacent fields at different vertical positions. Profile privacy cards could force a 320px viewport wider than the screen through grid-item intrinsic minimum sizing.

- Added `src/components/ui/native-select.tsx` and moved all 54 controls to it. The underlying element remains a native select with the existing IDs, values, option identities, handlers and refs. Controls have a 44px minimum height, consistent starting/chevron padding, mobile-size text, visible keyboard focus and disabled styling.
- Stacked field labels above selects with an 8px gap. Compact, intentionally horizontal controls such as the rest timer and coach-assignment rows retain their layouts.
- Kept logical starting/ending padding and moved the existing chevron with reading direction. Native option surfaces follow the active theme; forced-colors mode restores the system arrow.
- Allowed shared inputs and textareas to shrink within their containers. Grid children can shrink without widening the document; field controls align at the bottom of rows when labels wrap. Direct label/control pairs have consistent spacing, while checkbox, radio, range and compact horizontal labels retain their own layouts.
- Allowed long button captions to wrap and kept icon buttons from collapsing. Member navigation labels have explicit horizontal padding and centered text. Main content reserves bottom safe-area space for fixed navigation and the workout timer.
- Made the history filter a separate, bounded field; aligned admin member filters in a responsive grid; bounded the strength-chart selector; and aligned challenge invitation controls.

The pass covers training/workout tools, cardio, nutrition/scanning, imports, profile settings, measurements/photos, Pods/challenges, coach/program tools and admin member/exercise/invitation/shop/PV/analytics forms. It changes presentation and shared control sizing, not authorization, database schemas, logging values or synchronization rules.

## Verification

- All 399 unit tests passed across 61 files.
- The full native production browser suite passed 100 tests; one optional sync-traffic benchmark was skipped.
- All five Pages browser checks passed after the static build; compiled-output configuration/credential scans passed too.
- Four layout scenarios cover 66 combinations: 11 member/admin routes at 320px, 393px and 1280px in English and Arabic. They check document overflow, dropdown bounds, minimum target height, starting/ending padding and label/control gaps. Keyboard selection is exercised on the history filter.
- English/Arabic filter and mobile page screenshots are generated in ignored local `artifacts/alignment-*.png` files and visually inspected.
- TypeScript, changed/full-project ESLint and formatting checks passed. ESLint retains seven existing Fast Refresh warnings.

Run `npm run build`, start the production server on port 3173 and run the mobile Playwright suite. The focused layout check is `playwright test e2e/member-experience.spec.ts --grep "controls align across"`. Pages verification uses `npm run build:pages` and `npm run test:pages` after stopping any native preview that owns build assets.

Native picker presentation still depends on the browser/operating system; physical iOS/Android picker checks remain useful. The frontend changes are local until published.
