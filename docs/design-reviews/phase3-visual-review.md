# Phase 3 visual review — 11 November 2026

## References and captures

Inspected the supplied Stitch PNGs under
`design/stitch_prime_fitness_tracker_app/`: `today_prime_fitness_1`,
`today_prime_fitness_2`, `nutrition_daily_hub_prime_fitness` and
`add_food_sheet_prime_fitness`.

Synthetic browser captures are stored locally in ignored `artifacts/`:

- `phase3-today-en.png` / `phase3-today-ar.png`
- `phase3-nutrition-en.png` / `phase3-nutrition-ar.png`
- `phase3-food-sheet-en.png` / `phase3-food-sheet-ar.png`
- `phase3-avatar-crop-en.png` / `phase3-avatar-crop-ar.png`

Captures use a 390 × 844 CSS viewport. Responsive browser assertions also cover
320 and 1280px. They contain synthetic member records and synthetic photo pixels;
no private test-account credentials or real member images are included.

## Composition and interaction

Today has one session hero and one start/resume action, frozen exercise targets,
fuel, compact consistency, quests and secondary rank information. Nutrition uses
the source's date navigation, calorie/macro hierarchy, hydration and meal-card
composition. Food entry uses a bottom sheet with meal chips and method pills.
English and Arabic share these structures with logical RTL layout.

The cropper is an additional functional screen rather than a supplied Stitch
reference. Native range controls provide keyboard-accessible zoom and framing.
The preview matches the actual canvas crop. Gallery and camera selection remain
separate, labeled actions; images stay local until upload confirmation.

## Explicit differences and pending acceptance

- Source sample metrics, coach-verification claims and health classifications are
  not fabricated. Actual configured targets and frozen prescriptions take priority.
- Missing licensed exercise media uses the existing honest fallback presentation.
- Portion input remains a serving multiplier where food metadata does not support
  a reliable gram conversion.
- The established macro-entry form, scanner states, offline notices and recovery
  controls remain available even when absent from the static reference image.
- Source CSS viewport/device scaling is unrecorded. These captures establish
  reviewable implementation, not controlled pixel equivalence or 1:1 acceptance.
- Physical Android/iOS camera selection, permission denial, installed-PWA lifecycle,
  upload interruptions and on-screen keyboard behavior still require device review.

No staging, commit, push or deployment was performed.
