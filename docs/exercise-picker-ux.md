# Focused exercise discovery

November 12, 2026. Local implementation of the owner's approved picker improvements.
No commit, push, deployment, migration or hosted configuration change.

## Member experience

- **Suggested** opens with at most eight relevant exercises: current workout
  slots, actual recent history, favorites and editorial basics. Unknown catalogue
  variants do not fill unused places merely to create a long list. Reasons are
  labeled accurately; no popularity statistics or training-safety claims are invented.
- **Recent** combines unique exercises from completed working sets with exercises
  successfully added on this device. Row labels distinguish those sources.
- **Favorites** supports star/unstar and persists after refresh/offline use. These
  are device-local preferences for the current account/project, not cloud-synced
  favorites. Saving waits for the IndexedDB transaction; failures remain visible.
- **All** provides the full eligible strength catalogue in pages of 12. Search
  also starts at 12 results and uses the existing bilingual name/alias ranking.
  Search spans the catalogue even from Recent/Favorites, while explicitly selected
  muscle/equipment/mode filters continue to apply and are disclosed.
- **Browse by muscle** opens labeled tiles. Selecting a muscle closes the tile
  chooser and narrows the results. Equipment chips remain quick shortcuts;
  More filters contains the complete equipment selection and logging mode.
  Active filter values and Reset filters remain visible.
- Search, the animated view switcher and the Add action stay outside one scrollable
  browsing area. Descriptions are shorter. Thumbnails open media on demand, while
  exercise names open guidance. Closing guidance restores browsing scroll position.
- Multi-selection survives changes of view, search and filters. The existing
  maximum of 20 staged exercises and expandable review remain. Confirmation still
  uses the existing atomic workout transaction and stable retry slot IDs.
- Cardio-only search matches explain that cardio is logged separately in Train →
  Cardio & HIIT. They cannot be staged into strength sets. Archived exercises remain
  excluded; viewing historical exercise metadata is unaffected.

No new coach progression rule, weight transfer, reward or prescription is created.
Favorites/recents never silently add an exercise or submit a set.

## Implementation and data boundaries

| Module                                      | Responsibility                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/features/workouts/exercise-picker.tsx` | Browsing, filters, preview, staged selection and feedback.                                     |
| `exercise-picker-model.ts`                  | Pure catalogue filtering, shortcut ranking and shortlist/page limits.                          |
| `exercise-picker-store.ts`                  | Device preference transactions and bounded recent-history read/cache.                          |
| `use-exercise-picker-context.ts`            | Account/project-scoped queries and cross-tab device preference refresh.                        |
| `src/components/exercise-detail.tsx`        | Existing guidance, media and approved alternatives, extracted without changing their behavior. |
| `src/components/exercise-discovery.tsx`     | Compatibility exports for existing guidance consumers.                                         |
| `src/components/workout-session.tsx`        | Existing durable batch insertion, swap authority and modal sizing.                             |

Favorites and recent additions live in the existing member IndexedDB `references`
area under `exercise-picker-v1`, scoped by Supabase project and member. Up to 200
favorite IDs and 24 recently added IDs are stored; updates are transactional and
idempotent. Existing records, queued mutations and unrelated reference keys survive.
Other tabs receive existing storage-change notifications without transmitting
record payloads. No IndexedDB schema or personal-backup format is upgraded.

Recent completed performance reads at most 200 working-set rows, ordered newest
first, explicitly filtered to the member and joined to completed sessions. It
retains up to 24 unique exercise IDs. Existing RLS remains authoritative. The read
has cancellation and a ten-second timeout, runs only while the picker is mounted,
and is fresh in the query cache for one minute. A seven-day device cache supports
offline reads; expired/missing cache is identified as unavailable, not as complete
empty history. This is a bounded recent window, not the member's entire history.

Read/cache failure never blocks manual catalogue browsing or workout insertion.
Recent-choice bookkeeping runs only after accepted insertion and cannot turn a
saved batch into a failed action or create a second batch on retry. These preferences
earn no rewards and do not add a server mutation queue or authentication capability.

## Verification

Twelve Chrome scenarios passed, including English/Arabic shortlist, paging, global
Arabic-alias search from Favorites, combined filters, review scroll restoration,
favorite persistence, offline reload and batch insertion. Retained checks cover
failed local writes/retry, atomic staged batches, media on demand, full-catalogue
search, exercise options, plate tools, swapping and shared rest.

Six Windows WebKit scenarios passed for responsive layouts, shortcuts/favorites,
refresh persistence, guidance/filter interactions and full-catalogue search.
Service-worker installation/offline navigation runs in Chrome; the compatibility
configuration deliberately blocks service workers. WebKit exercises ordinary refresh
for the same data, with physical iOS/Android PWA testing still required.

Eighteen unit tests passed, including ten new model/storage tests for ranking,
combined filters, archived/cardio exclusion, concurrent/idempotent favorites,
quota failure, member/project isolation, preservation of unrelated references,
scoped completed-history filters and stale/offline cache handling. TypeScript,
targeted lint and Node production build passed.
Pages build/output verification passed for 20 static routes and 198 public files.

Evidence is ignored local `artifacts/picker-*.log` and sanitized
`artifacts/focused-picker-en.png` / `focused-picker-ar.png`. The prior full-catalogue
browser test now checks 12/24 results and explicit separate-cardio guidance; it still
searches the far end of the catalogue using Arabic names. The muscle-guidance test
opens the new chooser explicitly. No persistence/authorization assertion was removed.

## Review boundaries and next work

The owner-approved focused picker intentionally refines the original Stitch list.
The controlled exercise-selection frame now explicitly selects All with two staged
exercises; separate screenshots show Favorites in both languages. Overall comparison
coverage remains 15/60 with 45 pending and no final visual acceptance. Preferences
are not synchronized between devices. Mocked permission/isolation checks do not
replace a hosted RLS audit, screen-reader testing or physical-device validation.

Next: continue advanced-set, exercise-guidance, workout-completion/dialog and
cardio/HIIT controlled comparisons. Observe picker task completion during local
testing before claiming a numerical speed improvement.
