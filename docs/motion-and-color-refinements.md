# Motion and color refinements

Implemented locally on 2026-11-11 as presentation refinements to the Stitch redesign.

## Interaction behavior

| Area              | Behavior                                                                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation        | 140ms content fade on pathname changes. The existing outlet stays mounted; no animation-driven focus, scroll or draft resets. Search/filter changes do not replay it.                                     |
| Controls          | 120ms surface/color feedback, visible focus, restrained button press brightness. Inputs and rows never scale or move.                                                                                     |
| Overlays          | Shared 200ms enter/exit timing and navy-compatible dimming. Controls remain usable during transitions.                                                                                                    |
| Disclosures       | Short content fade; the muscle breakdown has a rotating chevron and keyboard focus outline. Large panels do not animate height.                                                                           |
| Today / Nutrition | Fuel widths interpolate only when rendered values change. No counter animation or mount-time fill from zero. Existing hydration feedback remains in use.                                                  |
| Workout           | Brief inset highlight for a newly saved or edited set. It consumes persisted rows, never the editable draft. Server acknowledgement remains separate.                                                     |
| Food              | Brief inset highlight after a saved food changes. Initial reads and date changes establish a baseline. Invalid input does not produce success feedback.                                                   |
| Progress          | Selected muscle fill/stroke transitions without moving geometry. Chart filter changes still render immediately without chart redraw animation.                                                            |
| Community         | Confirmed friendship and challenge changes can highlight their existing rows. No list movement or optimistic success celebration.                                                                         |
| Rewards           | Existing server-derived level-up celebration uses a single 280ms crest reveal. First reads establish a baseline, and refresh does not repeat an already seen level. This does not add a new badge dialog. |
| Sync              | Text/icons distinguish device save, actual sending, server acceptance and review. Sending is read from queue status; it is never inferred from connectivity. Errors and conflicts remain visible.         |

## Color roles

The existing navy surfaces and restrained gold remain. Shared `info` (sky
`#7DD3FC`) and `pending` (amber `#FBBF24`) tokens complement success emerald
`#34D399` and destructive coral `#F87171`. Labels and icons accompany status colors.
Sync summary tiles use restrained sky/amber borders and backgrounds. Measurements
and progress changes do not become success/failure assessments.

## Accessibility and integrity

CSS respects reduced motion. Programmatic record highlights and route fades also
check the preference and cancel when it changes during playback. Highlights have
no timers, looping effects, layout transforms or focus changes. No storage format,
permission, schema, synchronization owner, reward calculation or external service
changes are required. English/Arabic and RTL remain supported.

## Verification

Targeted browser checks cover draft recovery, offline fuel, English/Arabic Train,
Nutrition, Progress/Rewards and Community, invalid/save feedback, reduced-motion
changes, level-up replay protection, offline water recovery and sync conflicts.
Node and Pages production builds, TypeScript and targeted lint/format checks are
the release checks. Physical Android/iOS and assistive-technology acceptance still
require device testing. Changes remain local and uncommitted.

Result: 15 distinct targeted browser scenarios and six Pages smoke scenarios passed.
The invalid-save/reduced-motion case also passed after adding an explicit rejection
assertion. Node/Pages builds, TypeScript, formatting and whitespace checks passed.
Targeted ESLint reported no errors; the existing shared button-variant export has
one React Fast Refresh warning. No database migration or dependency was added.
