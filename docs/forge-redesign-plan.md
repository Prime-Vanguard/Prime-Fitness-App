# Prime Fitness: "Forge" UI redesign, workout sharing and friends feed

## Context

A page-by-page review (screenshots, EN and AR, 2026-11-28) and a comparison with commercial
apps (Hevy, Strong, Strava, Apple Fitness, Whoop, MyFitnessPal, Duolingo, Lyfta) found:

- Everyday screens (Today, Train, Progress, Nutrition) use a generic dark card kit: same
  radius, colour and padding everywhere; Inter + Manrope; a 115px header and a repeated giant
  page title. The "Forge" identity (crests, ranks, gold) lives only in Rewards and celebrations.
- Today has no hero; the streak and quests (the game loop) sit low on the page.
- Empty states are passive ("Your coach will set one up"; "Badges 0/0").
- Copy often describes the system instead of the member's next action.
- There is no shareable workout card and no friends feed; Lyfta and Strava grow through both,
  and WhatsApp is PV's main channel.

Goal: the app should be recognisable from one screenshot, put the game loop first, and add
sharing and a private friends feed. Decisions made by the founder (2026-11-28): the feed
reaches **accepted friends + shared pod**, v1 has **reactions + "Do this workout"** (no
comments), and **no photos** in v1. Per memory, Fitness may diverge from Stitch where better,
so this plan supersedes the one-to-one Stitch rule in `docs/premium-ui-ux-refactor-plan.md`
for the screens it changes.

## Design direction: the Forge, everywhere

**Colour (keep the navy and gold brand, add hierarchy):**

| Token           | Hex       | Use                                              |
| --------------- | --------- | ------------------------------------------------ |
| `--iron-950`    | `#0B1222` | App background (slightly deeper than today)      |
| `--iron-900`    | `#0F172A` | Standard cards (current `--background`)          |
| `--iron-800`    | `#1E293B` | Insets, inputs (current `--card`)                |
| `--gold`        | `#D4AF37` | Primary action, XP, rank (unchanged)             |
| `--ember`       | `#F0B54A` | Only for live moments: streak, new best, reacts  |
| `--steel`       | `#94A3B8` | Secondary text                                   |

Emerald stays only for "done" checks. No new hues.

**Type:** one display face for numbers, ranks and headings, plus the current body faces.
- Latin display: **Big Shoulders Display** (OFL, condensed and industrial; reads as struck
  metal, strong tabular numerals). Replaces Manrope.
- Arabic display: **Alexandria** (OFL, geometric Arabic with a heavy weight). Tajawal stays for
  Arabic body; Inter stays for Latin body.
- Self-host as woff2 subsets in `src/assets/fonts/` beside the existing files (offline PWA, no
  CDN), `font-display: swap`, and preload only the display weight used above the fold.
- Scale: 12 / 14 / 16 body; 20 / 28 / 40 / 56 display. Numbers always tabular. No all-caps
  labels (drop the tracked caps in the header and the "TODAY'S WORKOUT" eyebrow).

**Three surface levels** replace "every card the same":
1. **Forge band** (one per screen at most): `--iron-950` to `--iron-900` vertical gradient, a 1px
   gold hairline at the top, 20px radius, and a faint hammered-metal noise texture (CSS
   `background-image` from a 2KB SVG, disabled with reduced data or reduced motion).
2. **Card:** `--iron-900`, 14px radius, no border.
3. **Inset:** `--iron-800`, 10px radius, used inside cards.

**Shell:**
- Header 56px: crest mark at the start, the page name in the display face (replaces the giant
  in-page title), bell and menu at the end. Drop the duplicate profile icon (Profile stays in
  the menu and the avatar).
- Bottom nav: active tab gets a small gold notch above the icon, and the label switches to the
  display face. Five tabs stay.

**Principles:** spend boldness once per screen (the Forge band); everything else quiet. Every
empty state names one action. Copy speaks to the member, not about the system.

## Phase 1: foundation (no behaviour change)

Branch `feat/forge-foundation`.

- `src/styles.css`: add the colour tokens, the three surface utilities (`.surface-forge`,
  `.surface-card`, `.surface-inset`) and the radius tiers. Map `--font-display`/`--font-heading`
  to the new faces, with Tajawal/Alexandria fallbacks for Arabic.
- `src/assets/fonts/fonts.css` + woff2 files + OFL texts. Remove Manrope once it is unused.
- Shell: compact header and nav notch in the shell route
  (`src/routes/_authenticated/_shell/route.tsx`) and `src/components/page-header.tsx`. Pages
  pass their title to the header instead of rendering an `h1` block. Keep one `h1` per page
  for accessibility (visually in the header).
- New small shared pieces in `src/components/`:
  - `forge-band.tsx`: the level-1 surface wrapper.
  - `stat-number.tsx`: display-face tabular number with a label; reuses `RollingNumber`
    (`src/components/rolling-number.tsx`) when the value changes.
  - `empty-state.tsx`: icon, one sentence, one action (button or link).
- Update `docs/premium-ui-ux-refactor-plan.md` (design authority note) and
  `docs/motion-and-color-refinements.md` (decision 1 approved).

## Phase 2: page redesigns

One branch per page group. Reuse the existing data hooks; layout and copy only unless noted.

1. **Today** (`src/routes/_authenticated/_shell/today.tsx`, `today-session-hero.tsx`):
   - Forge band "briefing": rank crest (`RankCrest`) and level at the start, streak flame and
     count, the three quest rings (progress / goal), and the primary Start workout (or the
     program day's name and exercise count when scheduled). Reads in two seconds.
   - Remove the placeholder dumbbell box and the duplicated "Today's workout" eyebrow.
   - Below: "From your circle" strip (latest 3 feed posts, Phase 4), then Fuel (collapsed to one
     line with the calories ring when nothing is logged), then shields inside the streak detail.
2. **Train** (`src/routes/_authenticated/_shell/train.tsx`, `src/features/workouts/*`):
   - Workout tab: one-tap "Start empty workout" first; name becomes optional inside the session.
     Add "Repeat last workout" and up to 3 recent workouts as cards listing their exercises.
     Both start a free session with exercises preselected (shared helper, see Phase 4 "Do this
     workout").
   - My program: empty state with actions (start a free session; message coach on WhatsApp via
     `src/lib/contact.ts` once the link exists).
3. **Active workout** (`src/features/workouts/workout-exercise-card.tsx`, `planned-set-rows.tsx`,
   `workout-timers.tsx`, `workout-review.tsx`, `workout-sync-status.tsx`): the screen members use most,
   so it is tuned for one hand and a glance between sets. Layout and styling only; no data changes.
   - First: EN and AR screenshots at 360 and 412px (empty session, mid-session, rest running,
     offline) and a short page review. The items below are the starting list.
   - Session header: a compact sticky bar with elapsed time, volume and sets done in the display
     face, and Finish at the end. The workout name is optional and editable inline.
   - Exercise cards: the current exercise is expanded; finished ones collapse to one line with
     their best set. Exercise names in the display face. Secondary actions stay in the existing
     options menu so the card holds sets only.
   - Set rows: tap targets of at least 48px for weight, reps and the check. Last time's weight ×
     reps shows in every row as a ghost value (data already loaded by `usePreviousPerformance`
     in `src/hooks/use-workout-references.ts`). The done check fills gold with the existing
     set spark.
   - Rest timer: a docked bar at the bottom with a ring, −15 / +15 and Skip, readable at arm's
     length. Existing rest alerts stay.
   - Keep: offline sync status, wake lock, two-tab safety, every current set type, RTL and
     reduced motion.
4. **Debrief** (`src/features/workouts/workout-complete.tsx`): "Mission complete" moves into a
   Forge band with XP; add **Share workout** (Phase 3) and **Post to feed** (Phase 4) buttons.
5. **Progress** (`src/routes/_authenticated/_shell/progress.tsx`):
   - Overview leads with the muscle map in a Forge band; the three zero-stat cards become one
     compact stat row; the 10 muscle chips become a ranked list of worked muscles.
   - Rewrite system captions ("Each side/drop segment is a separate entry" moves into the
     "How it's calculated" details).
   - Body: ghost trend line in the empty state.
6. **Nutrition** (`src/routes/_authenticated/_shell/nutrition.tsx`): keep the structure; macro
   bars visible at 0%; drop the sync legend line (show sync state per entry only); recent foods
   first in Add food.
7. **Rewards** (`src/routes/_authenticated/_shell/rewards.tsx`): rank card becomes the Forge
   band; tabs fit (Journey, Shop, Community, Earn) with horizontal scroll fallback; badges
   section shows locked silhouettes, or hides when the catalogue is empty; Share achievement
   moves into the rank card.
8. **Profile, auth, onboarding:** quiet; header title only, Forge band on sign-in.
9. **Arabic pass for all of the above:** Arabic units (سعرة / جم / مل), Alexandria display,
   mirrored motion; the copy needs no draft marking (memory).
10. **Coach and admin:** tokens and header only; no layout work in this plan.

## Phase 3: shareable workout card

Branch `feat/workout-share-card`. No server change.

- Generalise `src/components/share-achievement.tsx` (it already renders to canvas, exports a
  blob and uses the Web Share API with a download fallback) into a shared canvas helper plus a
  new `src/features/workouts/workout-share-card.tsx`.
- Formats: story 1080×1920 and square 1080×1080; the member picks one.
- Content: crest and rank, workout title, Cairo date, duration, volume, working sets, top 3
  exercises with best set, "New best" plates, a small muscle silhouette coloured by worked
  muscles (reuse the muscle-map SVG paths), and the PV wordmark. English or Arabic follows the
  app language; Arabic is drawn RTL with Alexandria.
- Never includes body weight, photos, email or health notes.
- Entry points: debrief, history session detail, and a post in the feed (own posts).
- Share target: `navigator.share({ files })`, so WhatsApp works on Android; fallback is
  download.

## Phase 4: friends and pod feed

Branch `feat/friends-feed`. Needs migrations; ask before applying to production.

**Who sees a post:** the author, accepted friends (`private.social_friends`, which already
excludes blocked and paused members), and members of a shared pod who opted in
(`private.shares_pod` + `profiles.pod_feed_opt_in`), also checked with
`private.social_blocked`. Members choose per post: Friends, Pod, or both.

**Schema** (one forward migration, `SET LOCAL lock_timeout`):
- `public.workout_posts`: `id uuid pk`, `member_id`, `session_id unique` (one post per
  workout), `audience text check in ('friends','pod','both')`, `summary jsonb not null`,
  `created_at`, `deleted_at`. The summary is a snapshot built **server-side** from
  `set_logs`/`workout_sessions`: title, finished date, duration, volume, working sets, the
  exercise list (id, names EN/AR, working set count, best set), and new-best flags. No body
  data. Editing a workout later does not change a post.
- `public.workout_post_reactions`: `(post_id, member_id) pk`, `kind text check in
  ('respect','fire')`, `created_at`. One reaction per member per post, switchable.
- `public.social_accounts.feed_auto_share boolean not null default false`.
- RLS on both tables. Select policies call a `private.can_see_post(author, audience)` helper
  (SECURITY DEFINER in the non-exposed `private` schema, `(SELECT auth.uid())` style). No
  direct insert, update or delete grants: all writes go through the RPC.
- Indexes: `(member_id, created_at desc)`, `(created_at desc) where deleted_at is null`,
  reactions `(post_id)`, and every foreign key covered.

**API:** follow the existing `social_action` pattern: `public.feed_action(_op, _data)` is
SECURITY INVOKER and calls `private.feed_action` (SECURITY DEFINER, `REVOKE` from PUBLIC, anon,
authenticated; never directly executable). Ops:
- `share {session_id, audience}`: owner only, finished native session only, active member;
  builds the summary. Idempotent on `session_id`.
- `unshare {post_id}`: owner soft-deletes.
- `react {post_id, kind|null}`: only on visible posts; null removes.
- `list {before, limit≤20}`: visible posts newest first, with author display name, rank key,
  reaction counts and the caller's reaction. Keyset pagination on `created_at, id`.
- Rate limits through the existing `private.feature_allowance` (e.g. 30 shares and 300 reacts
  per day).

**Auto-share:** when `feed_auto_share` is on, an `AFTER INSERT` trigger on `xp_events` (source
`workout`) creates the post, as `private.publish_workout_activity` already does for pods. Once
the feed covers pods, a later migration drops the `pod_activity` publish trigger (the table
stays for history) and Pod Community reads the feed.

**UI:**
- `src/features/social/feed.tsx`: post cards with author crest and name, title, date, a stats
  row (duration, volume, sets), up to 4 exercises, new-best plates, reactions (Respect with a
  fist-bump icon, and Fire), "Do this workout", and on own posts Share card and Delete.
  Infinite scroll with `fetchAll`-style keyset paging and React Query.
- Placement: Rewards → Community gets **Feed** as its first section; Today shows "From your
  circle" (latest 3). Bottom nav unchanged in v1; revisit after usage data.
- Composer: the debrief's "Post to feed" opens a small sheet with the audience choice and a
  preview of the card. First use explains who can see it, and links to the auto-share switch in
  the existing Social settings (`src/features/social/social-panel.tsx`).
- **"Do this workout":** starts a free session with the post's exercises and set counts
  preselected through the existing picker selection (`src/features/workouts/select-exercises.ts`,
  `exercise-picker-store.ts`). Weights are not copied; last-time numbers come from the
  member's own history. The same helper powers "Repeat last workout" in Phase 2.
- Reaction notifications: a count badge on Community/Feed in v1; push notifications later.
- Offline: the feed is read-only and online-only, with a clear offline state. Reactions are not
  queued.

**Not in v1 (on purpose):** comments, photos, public follow or discover, and copying weights.

## Phase 5: copy and empty-state sweep

- One pass over EN and AR strings in `src/lib/i18n.tsx` and inline `l()` copy in the touched
  screens: lead with the member's action, plain verbs, no system terms.
- Every empty state uses `empty-state.tsx` with one action.

## Delivery order and size

| Order | Branch                    | Size   | Server change |
| ----- | ------------------------- | ------ | ------------- |
| 1     | `feat/forge-foundation`   | Medium | No            |
| 2     | `feat/today-briefing`     | Medium | No            |
| 3     | `feat/workout-share-card` | Medium | No            |
| 4     | `feat/friends-feed`       | Large  | Yes           |
| 5     | `feat/train-progress-ui`  | Medium | No            |
| 6     | `feat/active-workout-ui`  | Medium | No            |
| 7     | `feat/rewards-nutrition-ui` + copy sweep | Medium | No |

Founder review with screenshots after 1+2 (the new look), before the rest.

## Verification

- **Each branch:** `npm run lint`, `npm run typecheck`, `npx vitest run`, `npm run build`,
  `npx playwright test`, `npm run test:pages`.
- **Active workout:** the existing session e2e tests pass unchanged (sets, offline, two tabs,
  rest alerts); one new test checks finished exercises collapse and the ghost values show.
- **Visual:** Playwright screenshots of every touched screen in EN and AR at 360, 412, 768 and
  1280px (use the screenshot-spec copy method from this session, then delete it), compared
  before and after; reduced motion and Celebrations Off checked.
- **Feed database:** extend `scripts/check-member-experience.mjs`. A friend sees a post; a
  stranger does not; a blocked member does not, in both directions; a pod member sees it only
  with the opt-in; a paused author's posts disappear; nobody can react to an invisible post;
  direct insert or update is denied; `private.feed_action` is not executable by
  authenticated; the summary has no body data. Then `npm run test:database`,
  `npm run test:security`, `npm run test:performance`, and the Supabase advisors after applying.
- **Feed e2e:** in `fakeBackend`, a mock for `rpc/feed_action`. Tests: post from the debrief;
  the feed shows the card; react and un-react; "Do this workout" preselects exercises; offline
  state; Arabic RTL.
- **Share card:** unit test for the summary-to-layout function. In e2e, the file share path,
  checked with a stubbed `navigator.share`.
- **Performance:** check font payload and LCP with a production build on a throttled mid-range
  Android profile. Test on a physical low-end Android phone before release.
