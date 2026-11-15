# Controlled Stitch comparison checkpoint

November 12, 2026. Local work only; no commit, push, deployment, migration or
rollout change. Phase 6 visual acceptance remains open.

The [member-refinement continuation](#member-refinement-continuation) below records
Train/Profile changes. The latest [staff review pane checkpoint](stitch-review-pane.md)
adds an equivalent open-editor comparison and inferred 1.2× export calibration.
The [daily-page continuation](stitch-daily-pages.md) adds Today, Nutrition and
Progress: that checkpoint covered eight of 60 references, with 52 pending.
The subsequent [Progress-detail checkpoint](stitch-progress-details.md) adds
Strength, Body & wellness and Photos: that checkpoint covered 11 of 60, with 49 pending.
The latest [training-detail checkpoint](stitch-training-details.md) adds active
workout, exercise selection, My Program and History: **15 of 60 compared, 45 pending,
none finally accepted**. It also refreshes the earlier current captures to reflect
the approved consistent workspace navigation.
Earlier findings remain checkpoint history.

The latest [completion/cardio checkpoint](stitch-conditioning-completion.md) adds
two calibrated frames and fixes program-origin completion visibility. Current
coverage is **17 of 60 compared, 43 pending, none finally accepted**. The earlier
15-frame count above belongs to the preceding training-detail checkpoint.

## Evidence and scope

The [offline comparison report](../../artifacts/stitch-comparison/review.html)
contains original reference, baseline and current screenshots, plus adjustable
reference overlays. It embeds images and makes no network requests. All captured
accounts and records are synthetic. Full-resolution images and capture metadata
are retained in `artifacts/stitch-comparison/` (ignored local artifacts).

The first checkpoint compared five of 60 exported PNG references. The current
inventory is in `artifacts/stitch-comparison/inventory.json`; the latest coverage
is recorded above. **No screen has passed final 1:1 visual acceptance.**

The table below records the first checkpoint. The later member refinement and
[review-pane continuation](stitch-review-pane.md) supersede its Train baseline
and review-editor state/calibration findings.

| Frame         | CSS viewport / DPR | Calibration and remaining gaps                                                                                                                                                                                          |
| ------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff members | 1280 × 1062 / 1.25 | Scale inferred from the PNG's 300 px sidebar versus exported HTML's 240 CSS px anchor. Operational layout improved; source rank, Pod and activity columns require real supported data before inclusion.                 |
| Staff Pods    | 1280 × 1376 / 1    | Native source dimensions and sidebar anchor. Existing directory/actions preserved; source merger, split and workload summaries are not equivalent implemented capabilities.                                             |
| Staff review  | 1540 × 1600 / 1    | Output dimensions match, but export scale remains unresolved. Source has an open proof editor and unsupported video/form-check content; current overview is not an equivalent editor state. No pixel-parity conclusion. |
| Train         | 360 × 1600 / 1     | Current capture seeds a scheduled five-exercise program. Earlier baseline accidentally showed a free-session state and is explicitly labeled different-state. This fixture correction is not a Train UI change.         |
| Profile       | 415 × 1600 / 1     | Native mobile dimensions. Member-card density, account form composition and tab organization still differ substantially.                                                                                                |

Matching PNG dimensions alone does not establish matching content, state, font
rendering or export scale. Some source title rendering also differs from the
HTML's requested typography; the cause is unconfirmed. No numerical fidelity
score is assigned. Fixture media/history gaps must not be reported as proof that
the application lacks media/history.

## Corrections implemented

- Staff routes now put operational navigation first, with the existing admin
  gate. Member destinations remain accessible; member navigation is unchanged.
- Added a desktop staff toolbar using the real roster destination, existing
  notifications and signed-in profile. No fabricated global search, facility,
  system status or latency was added.
- Matched compact staff gutters and 24/32 title sizing, with a bounded canvas.
  Focused workout spacing remains intact.
- Member roster heading and existing counts align horizontally on desktop.
  Search, filters and the real invitation link precede the full-width roster.
  Collapsed rollout settings now follow it; reviewed write flows remain intact.
- Added an opt-in capture test and `scripts/review-stitch.mjs` to validate PNG
  dimensions and build reusable offline triptychs/overlays and the inventory.

Comments document presentation boundaries. No backend, authorization, reward,
draft or synchronization contract was changed.

## Verification

Node production build, Pages build, TypeScript and targeted ESLint passed. The
Pages output check scanned 20 static routes and 198 public files. Eleven Chrome
browser scenarios passed, covering the capture, EN/AR responsive matrices (480
document-width checks), staff roster/editor, workout draft retention, filter
alignment, sign-out isolation and reviewed role/access writes. The corrected
five-frame capture passed again after fixing the Train fixture. The comparison
generator completed and its contact sheets were inspected.

Logs: `artifacts/stitch-{build,pages-build,types,lint,regression,final-capture}.log`.
The Windows test server was stopped after the final capture passed because its
runner waited during teardown. Earlier Firefox/WebKit checks are historical
evidence; they were not rerun against this staff-shell correction. These are
mocked browser checks, not hosted authorization or physical-device acceptance.

To refresh current captures after a Node production build:

```powershell
$env:PW_STITCH_COMPARE = '1'
$env:PW_STITCH_STAGE = 'after'
npx playwright test e2e/member-experience.spec.ts -g 'Stitch controlled reference captures'
node scripts/review-stitch.mjs
Remove-Item Env:PW_STITCH_COMPARE, Env:PW_STITCH_STAGE
```

The current member comparison uses `member-baseline/train.png` and
`member-baseline/profile.png`: the previous checkpoint's corrected scheduled
program and account captures, saved before this continuation. The original
different-state Train baseline is retained under `before/` and in the
self-contained `previous-checkpoint.html`; it is not used to claim this visual
delta. For future changes, capture `PW_STITCH_STAGE='member-baseline'` **before**
editing member UI, then capture `after`. The generator reads each frame's
`baselineStage` from the manifest. Do not overwrite a baseline to manufacture a
before/after result.

Keep the original baseline artifacts: rerunning a `before` capture after edits
does not reconstruct the earlier application. The generator requires both saved
stages. A clean checkout must establish its own baseline before changing UI.

## Next implementation order

1. Close supported Train composition gaps: compact agenda placement, hero/media
   treatment and draft-resume hierarchy. Capture equivalent scheduled and draft
   states before judging visual deltas; retain all start/recovery actions.
2. Match Profile density and progressive disclosure of account/security settings
   without inventing biometric authentication or membership tiers.
3. Capture the staff review editor open and resolve export calibration; then
   compare remaining staff, Today, Nutrition, Progress and community states.
4. Repeat affected cross-browser, keyboard, RTL and offline checks after fixes.
   Physical Android/iOS PWA, screen-reader and final visual review remain gates.

Do not remove functional controls to resemble a static mockup. Unsupported source
features need a separate product/behavior decision; visual work must display real
data or an honest unavailable state.

## Member-refinement continuation

### Changes

- Train's scheduled-session title, week/day, exercise count and snapshot muscle
  tags now share the media area. The reusable `ExerciseHero` accepts a summary
  overlay with a tonal readability scrim; existing standalone media consumers
  retain their layout. Approved posters, explicit demonstration playback and
  fallback behavior remain intact. No session duration or RPE is invented.
- The compact agenda now uses one expandable secondary action. Its move/start
  controls remain available, with an explicit controlled-region association.
  The primary start action still uses the existing occurrence/draft controller.
- Profile uses a compact identity card with actual access/enrollment details.
  Photo controls, role labels, XP and existing activity statistics remain in a
  native disclosure; gallery, direct capture and crop/upload retry are retained.
- Password controls expand on request. Collapsing the form keeps input values
  mounted, and unsaved-password navigation protection still applies. Sign-out
  failures have their own visible feedback outside this collapsed form.
- Added read-only preference and storage overview rows linking to existing URL
  sections. They do not mutate preferences immediately or claim an empty sync
  queue. English/Arabic text, logical directions and reduced-motion behavior are
  preserved. Comments explain controller and presentation ownership.

### Verification and remaining gaps

Sixteen Chrome cases passed: the refreshed five-frame capture; EN/AR password
disclosures; EN/AR responsive route matrices (480 width checks); EN/AR Profile
navigation/fallback; unsaved preferences/password navigation; sign-out isolation;
coached frozen-program scheduling/start and agenda disclosure; EN/AR workout draft
recovery; EN/AR Today/offline nutrition; and EN/AR crop/upload retry. Three Windows
WebKit cases passed for both-language password disclosures and coached agenda /
occurrence start. TypeScript, targeted ESLint and Node/Pages builds passed. Pages
output verification checked 20 static routes and 200 public files. Formatting and
whitespace checks passed.

Evidence: `artifacts/stitch-member-{browser,regression,webkit,build,types,lint,pages-build}.log`.
The refreshed triptychs/overlays were generated and the Train/Profile captures and
Profile comparison sheet were inspected. These browser tests use synthetic API
fixtures; they do not certify hosted permissions or native Safari/installed PWA.

Composition is closer, but visual acceptance remains open. The shared header,
section-navigation treatment, source typography discrepancy, media/content
fixtures and additional settings still differ. Source-only ecosystem, biometric,
tier, telemetry and duration claims remain unsupported. All 60 references remain
in the inventory: five compared, 55 pending; none finally accepted.

Next: compare the open staff review editor with an equivalent source state and
resolve its export scale, then continue the remaining screen/state inventory.
Physical devices, screen readers and final 1:1 review remain release gates.
