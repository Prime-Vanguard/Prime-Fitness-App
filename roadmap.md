# Roadmap — improvements

- [x] 1. Reward shop + redemptions (PV spend, admin fulfill/reject with refund)
- [x] 2. Badges & milestones
- [x] 3. Opt-in weekly leaderboards
- [x] 4. Start assigned program day + RPE + previous-set memory
- [x] 5. Food library autocomplete + copy yesterday
- [x] 6. Private progress photos
- [x] 7. Admin analytics dashboard + CSV, audit log viewer
- [x] 8. In-app notifications
- [x] 9. Rank crests, level-up celebration, PV card polish
- [x] 10. Gym floor polish: accurate rest timer, vibration/sound, screen wake lock, discard workout
- [x] 11. Coach drill-down: member workouts, 7-day nutrition, progress photos

## Reliability fixes — 25 October 2026

- [x] Bilingual authentication, persistent feedback, recovery validation, password controls and mobile polish ([guide](docs/authentication.md))

- [x] Atomic week copying and program reassignment
- [x] Immutable published program versions and frozen training plans
- [x] Complete progress, streak and PV histories
- [x] Account-scoped full JSON backup with validated, additive restore
- [x] Metric/imperial logging, tools, measurements and progress displays

Details and acceptance boundaries: [reliability fixes](docs/reliability-fixes.md).

## Member experience features

- [x] Barbell plate calculator and progressive warm-up suggestions
- [x] Live exercise swapping and superset pairing with shared rest
- [x] IndexedDB workout recovery, automatic reconnect sync, retry and JSON backup
- [x] Custom foods, quick macros and favorite meal templates
- [x] Water-fill animation, optional sound and haptic preferences
- [x] Interactive 100-level journey with rank crests and titles
- [x] Local PNG achievement cards for levels and personal records
- [x] Two monthly, server-enforced streak shields
- [x] Pod leaderboard and private, opt-in workout feed
- [x] Same-pose progress photo comparison slider
- [x] Weekly primary-muscle volume diagram
- [x] Production PWA manifest, icons, offline training shell and install guidance
- [x] Million-XP curve to level 100, preserving existing rank ranges and Prime Legend at 91–100
- [ ] Approve rank perks
- [ ] Physical iOS/Android install, sound, haptic and signed-in member acceptance checks

Implementation, privacy rules, sync behavior and test commands: [member experience guide](docs/member-experience.md).

## Training depth and offline experience — 28 October 2026

- [x] Guidance/discovery editor, licensed text references and explicit alternatives
- [x] Timed, working/warm-up/drop and unilateral logging with historical snapshots
- [x] Coach-controlled progression and calendar/rotation scheduling
- [x] CSV import wizard with durable receipts and reward exclusion
- [x] Offline nutrition, body measurements and wellness with conflict recovery
- [x] Version-1 backup conversion, richer draft recovery and import provenance
- [x] Automated regression and latest-schema query diagnostics
- [ ] Coach/content and real provider-export acceptance
- [ ] Full local Supabase concurrency and physical iOS/Android PWA acceptance
- [ ] Gym Visual member-publication rights and invited pilot acceptance

Implementation, checks and remaining release gates: [training-depth report](docs/training-depth-offline.md). Features remain staff-only by default.

## Remaining review fixes — 28 October 2026

- [x] R11: durable redemption request IDs, idempotent receipts and pending/retry UI
- [x] R13: older-photo paging, independent comparison selection, signed-URL renewal and visible errors

Evidence and test commands: [redemption and photo-history follow-up](docs/redemption-and-photo-history-fixes.md).
