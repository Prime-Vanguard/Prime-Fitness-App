# Stitch: completion and cardio comparison

November 12, 2026. Local-only checkpoint; no commit, push, deployment, migration
or hosted change. **17/60 references compared, 43 pending, none finally accepted.**

## Controlled frames

| Frame            | CSS viewport / DPR | Raster output | Calibration and fixture                                                                                                                                                                                                      |
| ---------------- | ------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workout complete | 387 × 1422 / 1.125 | 435 × 1600    | Inferred from 72 px header / exported h-16 and approximately 50 px button / h-11. Five frozen slots, 17 working sets, 7,820 kg external volume and 52 minutes, completed through the normal UI and mocked server acceptance. |
| Cardio/HIIT      | 372 × 1067 / 1.5   | 558 × 1601    | Inferred from 54 px chips / h-9, header / h-16 and w-52 ring. One extra height pixel is recorded explicitly. Running first round, 45 s work / 15 s rest, 12 rounds, no preparation and 45 recent recorded minutes.           |

Scale is inferred from export anchors, not a guarantee about the original
renderer. Matching raster size is not pixel parity. Both completion captures
explicitly open the Workout hub after finishing the program day, keeping the
comparison state equivalent. A separate assertion/test verifies that completion
is also visible immediately on My Program.

New baselines live in `artifacts/stitch-comparison/conditioning-baseline/` and
start **after** the completion feature and running HIIT controls were implemented.
They establish presentation baselines, not a before/after claim for those
features. Earlier baselines are retained. The updated
[offline report](../../artifacts/stitch-comparison/review.html) embeds all 17
reference/baseline/current frames and adjustable overlays without network reads.

## Findings and corrections

- **Confirmed bug:** completing from My Program retained `section=program`,
  while the summary rendered only on Workout. The receipt now appears on both
  hub sections, without forcing a tab change. Refresh preserves it; active
  sessions, History and Cardio do not show it.
- Completion had a card around the entire panel plus cards around its metrics.
  Removed the extra outer surface, raised numeric emphasis and used the source's
  individual metric-card composition. The actual counts/calculations are intact.
- Moved the longer calculation explanation into an accessible native disclosure.
  Its keyboard opening is verified; the explanation remains available.
- Shortened Cardio's eyebrow to “Intervals & endurance” (localized in Arabic),
  preventing an unnecessary wrapped title block at the calibrated phone width.
- Comments document the program-origin visibility and explanation boundary.

## Remaining differences and acceptance limits

Completion is still a panel in the consistent Train hub, whereas Stitch shows a
dedicated stack screen. The shared workspace header, hub switcher, free-session
entry and navigation remain visible. A full-screen completion presentation needs
its own navigation/back/recovery acceptance, not a claim that the panel is 1:1.

The source's PR cards, comparison percentages, heart-rate values, rank transition
and proof-card export are not reproduced without supported data and behavior.
The real summary links to History and Rewards; it never invents an award.

Cardio keeps separate HIIT and steady-state modes instead of pretending the
mockup's named protocols are implemented. Running controls correctly show Pause
and precede read-only configuration. The source combines a running interval with
a Start button; that contradiction is not copied. Its 45/15 × 12 plan totals
**11:45** with no final rest, not 24:00. Heart-rate zones, prescribed weekly goals
and progress toward those goals are absent and are not fabricated. Recent actual
minutes remain available below the visible frame. A full starting interval has a
full progress arc; the source's partial arc does not match its displayed values.

No source-model photos, unsupported assets, real accounts or private data enter
the fixtures. Physical PWA, virtual keyboards, background sound and screen-reader
checks remain separate gates.

## Verification and reproduction

Local logs: `conditioning-baseline-valid.log`, `conditioning-after.log`,
`conditioning-cardio.log`, `conditioning-webkit.log`, `conditioning-review.log`,
`conditioning-lint.log`, `conditioning-build.log` and `conditioning-pages.log`.
The final browser cases cover calibrated capture, program-origin completion,
English/Arabic guidance/finish/summary, refresh/dismissal, offline acceptance and
HIIT configuration, pause/recovery and completion: **7 Chrome scenarios and 3
Windows WebKit scenarios passed**. TypeScript and targeted lint
pass; Node/Pages builds pass (20 static routes, 198 public files). No calculations
or storage formats changed in this checkpoint; the previous 57-unit-test result
is historical evidence, not a new unit-test run.

With a production Node server on port 3173:

```powershell
$env:PW_EXTERNAL_SERVER='1'
$env:PW_STITCH_COMPARE='1'
$env:PW_STITCH_STAGE='after'
$env:PW_STITCH_KEYS='training-complete,training-cardio'
npx playwright test e2e/member-experience.spec.ts -g 'Stitch controlled reference captures' --output=artifacts/conditioning-capture-results
node scripts/review-stitch.mjs
```

Next: audit and compare the nine onboarding references against supported setup
steps, then continue the remaining member/staff/system states. Do not introduce
the mockup's unsupported integrations as part of a presentation comparison.
