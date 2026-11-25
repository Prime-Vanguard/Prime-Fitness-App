# Gamification and game-feel plan

Draft, 2026-11-23. Based on the gamification UI/UX review and the founder's request for
custom animations, transitions and effects that make training feel like a game.
Arabic copy in this plan is a draft until the founder approves it.

## Goal

Members should feel every confirmed step forward the way a player feels a level-up:
seen, heard (if they want), and remembered. Progress stays honest: effects only
celebrate what the server has confirmed, never reward weight loss, and never push
members to skip rest.

## Design direction: "The Forge"

One visual language for every effect, taken from the rank names (Recruit, Seeker,
Forged, Guardian, Vanguard, Prime Legend) and the navy and gold brand.

- **Materials:** molten gold, embers, struck metal, heraldic crests. No generic
  confetti, emoji or neon.
- **Motion:** heavy and physical. Things are struck, stamped, forged and pinned.
  Fast in (120–200ms), short settle, no endless loops.
- **Colour:** gold for XP and level, the existing rank aura colours for rank moments,
  success emerald only for "done" checks. Everything else stays navy.
- **Sound (opt-in):** short synthesized metal and chime tones through the existing
  Web Audio helper. No audio files. Off by default.
- **Haptics:** one pattern per event type, reusing `haptic()`.

### Rules every effect follows

1. **Confirmed only.** Effects fire on server-confirmed changes (XP, level, badge,
   quest, redemption). Offline or pending values show a calm "pending" state, then
   celebrate once confirmed. Baselines are stored per member, as `LevelUpWatcher` does
   today, so a refresh never repeats a celebration.
2. **One at a time.** A single effects queue plays events in priority order
   (rank > level > badge > quest > streak milestone > XP) and merges duplicates.
3. **Never in the way.** During an active workout only small, non-blocking effects
   play (at most 400ms, no overlays, no focus change). Big moments wait for the
   workout debrief.
4. **Skippable.** Any celebration ends on tap, Escape or the back gesture. Focus
   returns to where it was.
5. **Accessible.** `prefers-reduced-motion` swaps every effect for a fade plus the
   same text. Every effect has a screen-reader announcement. Nothing flashes more
   than 3 times a second.
6. **Member control.** New setting: Celebrations **Full / Subtle / Off**, plus
   separate Sound and Vibration toggles.
7. **Fast on cheap phones.** CSS and the Web Animations API first. One small shared
   canvas for particles, only while an effect plays. Target 60fps on a low-end
   Android phone; no new dependencies.
8. **RTL.** Motion that travels sideways mirrors in Arabic.

## Phase 0: decisions needed from the founder

| #   | Decision                                                                                          | Status / recommendation                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Reverse parts of `docs/motion-and-color-refinements.md` (celebrations, count-ups, badge pop-ups). | **Approved 2026-11-23.**                                                                                                                                                                                                                           |
| 2   | Weekly quests: goals and rewards.                                                                 | **Decided 2026-11-23:** keep "about a year" to Level 100. Goals stay 3 workouts / 5 food days / 1 body check; +250 XP each, +750 XP for all three (1,500 a week, about 48 weeks to Level 100).                                                     |
| 3   | Streak and rest days.                                                                             | Recommended: planned program rest days count as active. Without a program, up to 2 rest days a week count automatically if the week has a workout. Shields stay for illness and travel.                                                            |
| 4   | Default celebration level.                                                                        | Recommended: Full. Automatically Subtle when the device asks for reduced motion; workouts always use small effects.                                                                                                                                |
| 5   | Sound default.                                                                                    | Recommended: off. Offer it once, after the first workout debrief.                                                                                                                                                                                  |
| 6   | Badge artwork.                                                                                    | **Decided 2026-11-23:** custom art per badge, with a different frame, material and finish per rarity (Common, Uncommon, Rare, Epic, Legendary, Mythic). Prompts in `docs/badge-art-prompts.md`. Locked badges show a dark silhouette made in code. |
| 7   | Arabic copy.                                                                                      | Recommended: approve the key terms once (below), then each phase's strings in one batch before it ships.                                                                                                                                           |

### Key Arabic terms (draft, needs approval)

| English                           | Arabic                                         |
| --------------------------------- | ---------------------------------------------- |
| Mission complete                  | اكتملت المهمة                                  |
| Weekly campaign                   | حملة الأسبوع                                   |
| Campaign complete                 | اكتملت حملة الأسبوع                            |
| New badge                         | وسام جديد                                      |
| New best                          | أفضل رقم جديد (already in the app)             |
| Level up / New rank               | ارتقيت مستوى / رتبة جديدة (already in the app) |
| Rest day                          | يوم راحة                                       |
| Celebrations: Full / Subtle / Off | الاحتفالات: كاملة / خفيفة / متوقفة             |
| Start a new streak                | ابدأ تتابعاً جديداً                            |

## Phase 1: fix and clarify (no new effects)

The review findings. Small, safe and worth shipping first.

Built 2026-11-24 on `feat/gamification-fixes`, except two rows that need Phase 5:
progress on locked badges (5.2) and quest bonus XP (5.1). Quests show the XP their
activities earn. The own leaderboard row shows "50+" when it is outside the top 50.

| Area            | Change                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recent XP       | Localized labels (Arabic shows English today), dates, empty state.                                                                                          |
| Leaderboard     | Always show the member's own row when opted in, even at 0 XP or outside the top 50. Format numbers by locale.                                               |
| Weekly quests   | Match the XP guide; show each quest's reward; "all done" state.                                                                                             |
| Streak          | Copy that agrees with rest days; gold flame instead of hard-coded emerald; "Start a streak" instead of "0-day streak"; fix the Arabic heading.              |
| Shields         | Friendly dates ("Today, 23 Nov") instead of `2026-11-23`.                                                                                                   |
| Rank card       | Progress label inside the level ("0 / 600 XP"), so an empty bar reads correctly.                                                                            |
| Journey map     | "Reached" for earned levels; remove the legal-sounding perks line until perks exist; locale-format XP.                                                      |
| Badges          | Progress on locked badges where the data exists; larger text than 11px.                                                                                     |
| Shop            | Hide search and filters when empty; "120 PV more" instead of "Not enough PV"; house checkbox component.                                                     |
| Tasks           | Show "Claim under review" on tasks with a pending claim; note field only after tapping Claim; empty state and dates in My claims; rename the tab "Earn PV". |
| Currencies      | One plain line: "XP = your level. PV = points to spend." Remove the repeats.                                                                                |
| Errors          | Plain, localized messages instead of raw server errors (tasks, leaderboard switch, shields).                                                                |
| Level-up dialog | Focus "Keep going" first; drop the spaced-capitals label.                                                                                                   |
| Arabic bidi     | Isolate mixed lines such as "XP 33,200 · الساعي".                                                                                                           |

## Phase 2: effects foundation

Build once, reuse everywhere.

Built 2026-11-24 on `feat/gamification-effects`: queue (`src/lib/celebrate.ts`), embers
(`src/lib/embers.ts`), sound kit (`celebrationSound`), motion tokens, settings and the
watcher for level, rank and badges. Not yet: XP, quest and redemption events in the
watcher. They arrive with the Phase 3 and 4 effects that show them. Settings are stored
on the device, like the existing haptics and water-sound switches.

| Piece                    | What it is                                                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `celebrate()` queue      | One module that accepts events (`xp`, `level`, `rank`, `badge`, `quest`, `streak`, `redeem`), merges and orders them, and plays one at a time. Respects the setting, reduced motion and "workout in progress". |
| Confirmed-change watcher | Extends `LevelUpWatcher` into one watcher for XP total, level, badges, quests and redemptions. Compares with the stored per-member baseline; first read sets the baseline.                                     |
| Motion tokens            | Adds `--motion-strike`, `--motion-celebrate` and a spring-like ease to the existing tokens in `styles.css`.                                                                                                    |
| Ember canvas             | One shared, lazily created canvas for gold sparks and embers (about 80 lines, no library). Paused and removed when idle.                                                                                       |
| Sound kit                | `forgeStrike`, `chime`, `rankFanfare` built from oscillators in `device-feedback.ts`. Obeys the Sound setting.                                                                                                 |
| Settings                 | Celebrations Full / Subtle / Off, Sound, Vibration in Profile → Device settings. Saved with existing offline profile settings.                                                                                 |
| Tests                    | Unit tests for queue ordering and merging; e2e for no-repeat after refresh, reduced motion and "Off".                                                                                                          |

## Phase 3: the big moments

Built 2026-11-24 on `feat/gamification-moments`: 3.1 (without quest and streak
updates in the debrief), 3.2, 3.3, 3.4 (dot on the Rewards tab) and 3.6. 3.5 waits for
Phase 5.1. The debrief's "+XP" is the confirmed XP gained since the workout was opened
in this tab. The rank name is revealed with a wipe instead of letter by letter, because
splitting Arabic into letters breaks how they join.

### 3.1 Workout debrief ("Mission complete")

Replaces the plain summary top section. A 3–4 second sequence the member can skip:

1. Title stamps in: "Mission complete" / "اكتملت المهمة".
2. Duration, volume and sets count up quickly.
3. New bests slam in as gold plates with a short shimmer.
4. XP bar fills with "+50 XP", embers rise from the bar. If not yet synced:
   "+50 XP after sync" with a pending outline; the fill plays later when confirmed.
5. Quest checkmarks and the streak flame update.
6. Any level, rank or badge event queued during the workout plays now.

### 3.2 Level up ("Forged")

Full-screen overlay: crest shards fly together and lock with a strike, a gold ring
pulses once, the level number drops in. Several levels at once roll the number
(3 → 4 → 5). Share and Keep going appear last.

### 3.3 Rank up ("Ascension")

Bigger version of 3.2: the old crest cracks into embers, the new crest rises with
its rank aura colour, the rank name is struck letter by letter. Plays only for a
real rank change. The share card offers the new crest.

### 3.4 Badge unlock ("Medal pinned") — built 2026-11-24 on `feat/gamification-badges`

Built version: rarity artwork and glows in the Rewards grid, a detail sheet, and a
non-blocking unlock card (drop, swing, light burst, 5s auto-dismiss).
Not a full dialog. A medal drops from the top, swings once, a glint sweeps across it,
and it shrinks into the Rewards tab icon, which shows a dot until opened. Tapping it
opens the badge.

### 3.5 Weekly campaign complete

When all weekly quests are done: the three checks link with a gold line, then a
"Campaign complete" seal stamps over them with the reward (needs decision 2).

### 3.6 Streak milestones

The flame grows by tier: ember (1–2 days), flame (3–6), gold flame (7–13),
white-gold (14–29), crowned flame (30+). Reaching a new tier plays a short flare.
Using a shield: a shield slams over the day with a ripple. A broken streak never
shows anything negative, just "Start a new streak".

## Phase 4: everyday feel

Built 2026-11-24 on `feat/gamification-everyday`, except "New best set" during a
workout (it would need a history read per exercise while training; the debrief already
shows new bests) and the set-logged spark (the stamp only). The "+XP" chip rises into
the rank crest on Rewards rather than flying from where XP was earned. Browsers without
View Transitions switch Rewards sections instantly. "Since last visit" marks
(leaderboard arrows, request stamps) are kept per member on this device.

| Moment                           | Effect                                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Set logged                       | Check "stamps" into the row (scale 1.15 → 1, 180ms) with a tiny spark. Replaces the inset glow.                  |
| New best set                     | Gold plate slides behind the row with "New best" and one glint.                                                  |
| Rest finished                    | Rest bar flashes gold once; existing sound and vibration.                                                        |
| XP confirmed (outside a workout) | "+XP" chip flies from where it was earned to the rank chip, which pulses and its bar fills. Mirrors in RTL.      |
| Numbers changing                 | XP, PV and quest numbers roll to the new value (300ms) when they change, never on first load.                    |
| Rewards tabs                     | Direction-aware slide using the View Transitions API, with a fade fallback.                                      |
| Journey map                      | Current level pulses once on open; locked levels sit behind a light fog; tapping a locked level shakes the lock. |
| Leaderboard                      | New week: rows slide into place; arrows show places gained or lost since last visit.                             |
| Shop                             | Confirm: a "Requested" stamp. When the request is approved: "Approved" stamp on next visit.                      |
| Pull-to-refresh / sync done      | Small ember burst on the sync indicator when queued items are accepted.                                          |

## Phase 5: features that need the server

These need migrations and RLS review, so each one gets its own approval.

1. **Quest rewards.** XP rule for completing each quest and the full week, awarded
   server-side and shown in Recent XP.
2. **Badge progress.** A read-only view that returns progress per badge for the
   member (for example 2 / 5 workouts).
3. **Own leaderboard row.** Return the member's weekly row and position even outside
   the top 50.
4. **Workout XP in the debrief.** Return the XP events created by a finished workout
   so the debrief shows exact amounts.
5. **Rest-day streak.** If decision 3 says yes, planned rest days from the program
   count as active.

## Not included, on purpose

- Combos or timers that reward logging sets faster. They push people to cut rest.
- Loot boxes or random rewards. Rewards stay predictable.
- Rewards for weight change. Body rewards stay for tracking only.
- Celebrations for unconfirmed or offline-only data.
- Effects that loop on idle screens.

## Delivery

- New branch per phase, starting `feat/gamification-fixes` (Phase 1).
- Each phase: unit tests for new logic, e2e for English and Arabic, reduced motion and
  "Off" setting, screenshots for review, check on a low-end Android phone.
- Diverges from the Stitch designs for Rewards, Today and the workout summary; the new
  screens need founder review.
- Update `docs/motion-and-color-refinements.md` once decision 1 is approved.

## Rough size

| Phase             | Size         | Server change            |
| ----------------- | ------------ | ------------------------ |
| 1 Fix and clarify | Small–medium | No                       |
| 2 Foundation      | Medium       | No                       |
| 3 Big moments     | Large        | No (3.5 needs Phase 5.1) |
| 4 Everyday feel   | Medium       | No                       |
| 5 Server features | Medium       | Yes, migrations          |
