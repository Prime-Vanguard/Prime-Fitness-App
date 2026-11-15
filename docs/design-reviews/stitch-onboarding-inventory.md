# Stitch onboarding: initial implementation inventory

## Latest: complete supported flow — 15 November

The units-only entries below are historical. Training goals, experience, weekly
availability and equipment now save as validated coaching context and appear in
review, ready, Profile and authorized coach views. The optional apps screen
documents unavailable linking and leads to real device installation guidance.
All nine onboarding browser cases passed in a 24-case auth/member regression
selection. See [the onboarding contract](../onboarding.md) for database, backup,
retry and release evidence. Arabic synthetic ready-state capture:
`artifacts/onboarding-full-ready-ar.png` (visually inspected). It predates the
final copy refinement distinguishing editable language/units from read-only
training context; it is not an exact equivalent-state visual acceptance.
Controlled comparison coverage remains 17/60; physical devices, assistive
technology and calibrated overlays remain open. No passkey, cross-app sharing,
background push or adaptive-program promises were copied from the references.

## Supported training preferences — 15 November

The training-focus PNG and HTML were reviewed against the actual onboarding
draft/profile contract. Units are the supported preference. The dedicated
screen now has large metric/imperial cards, an explicitly labeled conversion
example using shared canonical-unit helpers, coach-assignment guidance and an
expandable explanation of actual RPE versus prescribed effort. Existing field
names, validation, save/retry identity and review remain intact.

The reference's primary focus, experience, weekly days and equipment controls
remain unimplemented: adding them needs durable contracts and coaching visibility,
not presentation-only selection. Its adaptive-program and encryption promises
were not copied. System linking remains unsupported. This checkpoint does not
claim all nine reference screens or 1:1 parity are complete.

Seven focused onboarding browser cases reported passing, with bilingual captures
rerun successfully after synchronizing decorative-marker bounds on resize.
Coverage includes 320/393/768/1280px, reduced motion, keyboard disclosure, 60 kg →
132.28 lb preview, back-navigation retention, consent/retry, installation and
program availability. Captures: `artifacts/onboarding-training-{en,ar}.png`.
English and final Arabic frames were inspected. Initial capture timing caught
the marker before its ResizeObserver update; capture now waits for aligned bounds.
TypeScript, targeted ESLint and Node build passed. Physical-device and assistive
technology acceptance remain open. Controlled comparison coverage stays 17/60.

## Optional device setup and ready screen — 15 November

Inspected notification/install and ready reference PNGs. An optional screen is
available from completed setup; it reuses Profile's installation component and
describes the in-app notification inbox. Background push/reminders are not
implemented, so no permission request or fake toggle is shown. The real browser
install event controls availability; manual instructions cover other browsers.
Skipped, failed and requested installations are distinct from confirmed
appinstalled/standalone state. Setup remains saved regardless of device choice.

The ready screen uses reference-inspired panels and a shield, with actual saved
preferences, actual program-check results and a primary Today destination. It
does not invent rank/XP, tiers, Pod/coach names, prescriptions or a schedule.
Source hero/title ordering and unsupported content still differ; this is not
1:1 visual acceptance. The 17/60 calibrated comparison count is unchanged.

Eighteen selected mobile Chromium auth/onboarding cases reported passing. New
EN/AR cases cover ready/device navigation, focus, 320/393/768/1280px, reduced
motion, install dismissal/failure/requested/confirmed transitions. Existing cases
cover invitation/recovery, setup consent, retained choices and uncertain-save
retry. Captures are `artifacts/onboarding-{ready,device}-{en,ar}.png`; English
device and Arabic ready frames were inspected. TypeScript, targeted lint and
Node build passed. The Windows runner was stopped during teardown after all
results. Actual Android/iOS installation and screen-reader review remain open.

## Access and invitation continuation — 15 November

Inspected both access/invitation reference PNGs and HTML alongside the current
authentication route. The route now reuses the compact onboarding shell and
reference-inspired navy input/context panels with a separate gold primary action.
This applies to sign-in, email-based invitation signup, confirmation and reset
requests. Existing password controls, generic feedback, validation, cooldowns,
request locks and redirect rules remain in place. The public auth modes do not
claim a setup-step number or verified invitation before server acceptance.

The mockup's passkey, one-time code, invitation token, named inviter and Pod
allocation have no equivalent verified backend contract and remain absent.
Accordingly these are supported-flow adaptations, not equivalent-state 1:1
acceptance or additional calibrated comparisons in the 17/60 inventory.

Eleven mobile Chromium auth scenarios reported passing. New EN/AR cases cover
320, 393, 768 and 1280px, reduced motion, heading focus, LTR email, real signup
fields and touch target sizing. Existing cases cover login, invitation failure,
resend/reset cooldown, recovery refresh/retry, pending requests and safe redirects.
Synthetic captures: `artifacts/stitch-access-{en,ar}.png` and
`artifacts/stitch-invitation-{en,ar}.png`; English sign-in and Arabic invitation
were visually inspected. TypeScript, targeted lint and Node build passed. The
Windows test runner was interrupted during teardown after all 11 results.
Physical devices, assistive technology and final visual acceptance remain open.

## 15 November: first implemented screen slice

New members now enter a dedicated Welcome / language screen using the local
emblem, centered wordmark, language cards and gold action from the Stitch
reference. It introduces the existing three-step setup; it does not display
the reference's six/nine-step indicator because those steps are not implemented.
The setup steps and completion now use a separate compact onboarding shell,
with phone-width actions, larger headings and separate profile/consent panels.
Going back to Welcome retains entered setup values. Completed members continue
directly to the real completion/program-check state.

The five focused mobile Chromium scenarios reported passing in English/Arabic,
including native radio arrow keys, RTL, consent gating, lost-save receipt recovery,
program/profile retry and retained fields. The two bilingual layout cases cover
320, 393, 768 and 1280px and reduced motion. Synthetic captures are stored under
`artifacts/onboarding-stitch-v1-{en,ar}-{welcome,profile,consent}.png`; English
welcome and Arabic consent captures were visually inspected. TypeScript, targeted
lint and Node build passed. The runner was stopped during its known Windows
server teardown after all five results. These are not physical-device or
screen-reader acceptance, and do not increase calibrated 17/60 coverage.

The original inventory below is historical. Invitation/access, training-focus,
system-linking and notification/install references are still separate follow-up
work. No unsupported authentication, integrations, calculated metrics or privacy
promises were added. Profile fields and consent wording keep the actual contract.

This is a source-and-code inventory, not a visual comparison or acceptance. The
nine Stitch HTML exports were inspected alongside `src/routes/auth.tsx` and
`src/components/onboarding-workspace.tsx`; no real member data was used.

| Reference               | Current counterpart and scope                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Welcome / language      | Language selection is in the first signed-in setup step, alongside display name; it is not currently a separate welcome step.                                                                    |
| Accept invitation       | Sign-up presents an invitation requirement; do not imply the mockup's verified token, inviter or Pod assignment is real without confirming the actual flow.                                      |
| Sign-in / access        | The current sign-in uses email and password. The reference's passkey and one-time-code screen must not be presented as functional without an approved authentication implementation.             |
| Your profile            | Display name, language and units are supported in setup. The reference's additional profile fields and calculated benchmarks are not established by this inventory.                              |
| Your training           | The current second step selects units; the reference's training-focus and experience controls are not equivalent. Do not imply that selecting them changes a program.                            |
| Safety / consent        | The real third step reviews saved choices and requires consent. Preserve its text, validation, focus behavior and save recovery when refining the composition.                                   |
| Link the system         | The illustrated cross-product integration, XP transfer and telemetry claims are not established by this inventory; do not add them as functional claims.                                         |
| Notifications / install | The reference describes specific alerts and offline guarantees. Verify actual capabilities individually before displaying or promising them.                                                     |
| You're ready            | The real completion state reflects profile save and queries for an active assignment; it handles unavailable or absent assignments. Do not invent a schedule, rank progress or coach assignment. |

The mockups themselves use inconsistent six- and nine-step numbering. The app's
three-step indicator must continue to represent its actual flow. Existing setup
preserves name validation, keyboard-accessible radio choices, consent and an
unchanged retry payload after an uncertain save. These are behavior constraints,
not evidence of visual parity.

Next: create controlled synthetic-state captures for the supported equivalents,
calibrate their viewport against each reference, and record differences before
making visual changes. Verify English/Arabic, RTL, mobile and keyboard behavior.
Unsupported reference states remain explicitly unaccepted; no count of completed
Stitch comparisons is increased by this inventory.

## Profile and consent qualitative review

Synthetic English and Arabic captures of the current profile and consent steps
were taken before and after the local presentation change at 393 × 1067 CSS
pixels, using the mobile Chromium test configuration. The profile and consent
reference PNGs were inspected; their steps contain different fields and content
from the real workflow. These are qualitative comparisons, not calibrated
matching-state overlays, so the 17/60 controlled comparison count is unchanged.
Local images are `artifacts/onboarding-{baseline,after}-{en,ar}-{profile,consent}.png`.

The mobile setup form now begins at the top instead of vertically centering in
the viewport, and the consent text and existing required checkbox are grouped
in a distinct panel. The displayed three steps, existing consent language,
choice state, focus management, save behavior and retry identity are unchanged.
The reference's extra agreements, medical statements and encryption promises
remain absent. The surrounding shared shell, navigation and actions continue to
differ from the reference; no 1:1 visual acceptance is claimed.

Five focused mobile Chromium scenarios reported passing, covering English and
Arabic layouts with reduced motion, checkbox gating, keyboard focus, retained
choices, a lost save receipt, unavailable program and profile retry. TypeScript,
targeted ESLint and the Node production build passed. The Playwright web server
needed manual interruption after all five scenarios reported passing. Physical
devices, screen readers and a calibrated reference comparison remain open.
