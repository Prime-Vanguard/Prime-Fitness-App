# Member experience enhancements

See [25 October reliability fixes](reliability-fixes.md) for transactional programs, frozen versions, complete history, imperial units and the full personal backup/restore flow.

## Where to find them

| Area      | Features                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Train     | Barbell plates and warm-up sheet, exercise swaps, one active superset pair with shared rest, previous-set shortcuts, durable offline logs, sync status and JSON backup |
| Nutrition | Quick macros without a library search, personal custom foods, ingredient-level favorite meal templates, water fill animation and optional sound                        |
| Rewards   | Interactive 100-level journey, rank crest/title previews, PNG story cards, weekly Pod leaderboard and opt-in Pod workout feed                                          |
| Today     | Two streak shields per calendar month, enforced by the database                                                                                                        |
| Progress  | Same-pose photo comparison slider, weekly primary-muscle set/volume diagram, personal-record story export                                                              |
| Profile   | Installation instructions/prompt, water-sound and haptic preferences                                                                                                   |

All added controls support English and Arabic. Motion follows the device's reduced-motion preference. The existing brand logo is preserved in app icons and exported cards.

## Workout persistence and reconnect

- IndexedDB database `prime-fitness-workouts`, schema version 1, stores one active workout per signed-in member, its exercise library, sets, notes, superset and rest deadline. Local records are scoped by member ID.
- Set logging reports success only after the IndexedDB transaction commits. Failed device writes remain visible as errors and can be retried. An export button downloads the local workout as JSON.
- Writes read the latest record in a single read/write transaction. Browser tabs announce updates through BroadcastChannel; Web Locks serialize network sync when supported. Stable UUIDs and insert-with-ignore-duplicates make retries safe if a response is lost after the server accepted it.
- Deleted sets remain tombstones until the server acknowledges deletion. Finishing waits until all sets are accepted before closing the session. XP and badges remain server awarded; the client never grants them offline.
- Sync retries on reconnect, focus, and every 15 seconds while the signed-in app is open. Closing the app pauses sync; reopening resumes it. Authentication expiry or server rejection preserves the local draft and offers retry/export.
- A previously signed-in browser and a downloaded exercise library are required for offline use. Clearing site data or changing origin removes access to browser-local drafts. Synced logs remain in Supabase.
- A workout finished on another device is preserved on the server. Export any unsynced local differences, then discard the local copy to start another workout.

## Shared data and privacy

The `member_experience` migration adds member-owned `saved_meals`, `streak_shields`, and server-written `pod_activity`, plus secure views for Pod scores and complete XP totals. All new tables have RLS. It also removes the existing circular Pod read-policy dependency while preserving member/self and leader/roster visibility.

Favorites are private to their owner. They contain user-entered, unverified nutrition values. A meal template preserves each ingredient as a separate food-log row.

Shields protect today or yesterday in Cairo time, continue an existing streak, and never award XP. Two may be consumed per calendar month of the protected date. Consumption is immutable; the server serializes the monthly budget check.

Pod feeds are off by default and use a separate opt-in from the weekly leaderboard. Only current members/leaders of the same Pod can read entries, and turning sharing off hides existing entries. Feed entries contain a display name, workout title, timestamp, and the server-awarded workout XP; no body photos or nutrition details are shared. Entries are generated only for subsequent completed workouts after opt-in.

Story cards are generated locally as 1080×1920 PNGs. Members preview the name and achievement before downloading or invoking their device's share sheet. The app never posts automatically. Rank perks remain pending approval. The approved [million-XP progression](progression.md) keeps all rank ranges unchanged, including Prime Legend at Levels 91–100.

## PWA deployment

The production build emits `/sw.js` with a build-specific precache of public assets and the client-only `/train` shell. API/auth responses, photos, and writes are excluded. Offline navigation to training restores the app; other pages show an offline page linking back to training. New service-worker versions wait for existing windows to close before activation.

Use HTTPS on a permanent origin for installation; localhost works for development checks. Vite development mode does not register the production service worker. iOS uses Safari's Share → Add to Home Screen; compatible Android browsers can show an install prompt. Haptics and native sharing depend on browser/device support. Sound is off by default and can be enabled in Profile.

## Verification

The [approved base rank artwork](../design/rank-emblems/README.md) is used throughout the app and in exported achievement cards. Its optimized public assets are included in the offline cache.

```sh
npm test
npm run typecheck
npm run test:db
npm run build
npm run test:e2e
```

The database check applies every migration to isolated Postgres/WASM and checks member isolation, Pod privacy, XP behavior, and shield limits. It never connects to the live database. Browser checks use mocked Supabase responses and installed Chrome; they cover offline refresh/reconnect with a lost response, concurrent tabs, failed local writes, training tools, favorites/water, roadmap/export, photo comparison, and Arabic mobile layout.

Production build, automated browser checks, and schema checks do not substitute for signed-in acceptance testing with real members or physical iOS/Android install, audio, and haptic checks.

Verified on 24 October 2026: 23 unit/storage tests, five mobile Chromium browser scenarios, 24 database assertions across all 15 migrations, TypeScript, and the production build passed. Changed files pass ESLint; the remaining 350 full-project errors are formatting issues in older files.

Migration `20261023233043_member_experience.sql` was applied to the connected Prime Fitness Supabase project. Live checks confirmed RLS on the three new tables, `security_invoker` on both views, and private schema placement for the permission helpers. The security advisor reported no new table/function warnings; the Auth leaked-password-protection setting remains disabled.

If a restricted Windows session prevents Playwright from stopping its own server, start the production server separately on port 3173 and run with `PW_EXTERNAL_SERVER=1`; the suite will use that server. The completed verification used this mode and exited successfully.

Subsequent RLS/index optimization and its live verification are documented in the [database performance report](performance/README.md).
