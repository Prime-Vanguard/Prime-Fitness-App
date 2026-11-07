# Full exercise catalogue — 7 November 2026

The pinned `hasaneyldrm/exercises-dataset` catalogue contains 1,324 source exercises. Prime Fitness stores their English instructions, Arabic draft translations, source identities, classifications and external image/GIF URLs in the existing exercises table. No media files or translation models are uploaded to Supabase Storage.

## Verified hosted result

### Encoding correction after the initial import

The initial import's PowerShell file read used the Windows default code page instead of UTF-8. This stored garbled Arabic even though the local source files and isolated seed tests were correct. The initial hosted completeness checks counted nonempty strings and did not detect the corruption.

The live catalogue has now been repaired using exact damaged-source hashes. Each replacement must decode to the expected original-content hash; unrelated text and coach edits are preserved. All 1,324 source rows now match the local English and Arabic instruction snapshots exactly, with zero encoding-marker matches in Arabic names/instructions. The nine original custom Arabic names remain intact, and the catalogue still contains 1,327 exercises. The [corrected-content verification](performance/exercise-catalogue-encoding.json) records that boundary; the storage report below describes the initial import measurement.

Generated seed SQL now encodes Unicode as ASCII JSON escapes, so Windows code-page decoding cannot alter names, instructions or attribution. `npm run test:catalogue:encoding` verifies ASCII transport, damaged Arabic/punctuation repair, replay and preservation of human edits. The main catalogue test additionally compares stored Arabic instructions against the complete source snapshot. Both checks run in the database suite. `scripts/build-exercise-encoding-repair.mjs` prepares the one-time guarded repair under ignored artifacts; it does not run in the browser or change schema/permissions.

This correction is live and requires no frontend deployment. Reload an already-open page to replace stale query/device data. Arabic content remains a machine-translation draft pending editorial review; fixing encoding does not establish coaching accuracy.

The connected database now contains 1,327 exercises: 1,324 source-linked entries and three unmatched originals. All 1,324 source entries have Arabic names/instructions and both external media references. All 12 original identities, Arabic names and measurement settings were preserved; existing set-log and frozen-version counts were unchanged. No client-callable public security-definer function was introduced.

Measured exercises-table storage, including indexes and TOAST, grew from 49,152 bytes to 3,080,192 bytes: an increase of 3,031,040 bytes (about 2.89 MiB). Media uploads consumed zero Supabase Storage bytes. This measures the catalogue relation, not total project storage, backups, WAL or future bandwidth. The read-only verification report is retained in [exercise-catalogue-storage.json](performance/exercise-catalogue-storage.json).

Verification passed: 399 unit tests, the full isolated catalogue seed/retry checks, 49 security assertions, 720 historical permission/performance comparisons, TypeScript, changed-component lint, production build and Pages build/output scan. Two distinct targeted mobile scenarios passed across the initial and focused rerun; the new catalogue case needed a test locator correction because its exercise button also contains classification text. The catalogue case verifies paging, Arabic-name search beyond 1,000 rows and disabled cardio selection; the existing timed-guidance/reload case passed unchanged. The hosted advisor retains the pre-existing leaked-password-protection warning and intentional no-policy informational notices; this change introduced no new warning category.

The database migration and catalogue content are applied. Frontend changes remain local until published; no GitHub Pages deployment was performed in this task.

## Identity and history preservation

The reconciliation uses explicit equivalents or unique exact name/equipment matches against exercises without an existing source identity. Once linked, the repository/source ID is authoritative. Distinct source IDs remain distinct even when their names match. Ambiguous existing matches fail rather than silently merge. A partial unique index prevents duplicate source identities.

Nine of the original 12 exercises have unambiguous equivalents. Their IDs, existing Arabic names, muscles, equipment, load conventions and logging modes remain intact. Overhead Press, dumbbell Walking Lunge and the unweighted Plank remain independent because the available source variants do not establish an exact equivalent. The resulting catalogue has 1,327 exercises, including all 1,324 source records.

Seeds run in 27 transactions of at most 50 exercises. Stable IDs, source uniqueness and a transaction lock make retries safe. Existing guidance keys, reviewed records and archived states are preserved. Shared catalogue data is additive; no member workout, program assignment, frozen version or reward record is rewritten.

Migration `20261107211011_full_exercise_catalogue.sql` is recorded on the connected project as `20261107212031_full_exercise_catalogue`. Preserve that explicit timestamp mapping; do not rewrite hosted migration history.

## Arabic and classification review

The translation snapshot covers all 1,324 names and 7,710 ordered instruction steps. Automated checks require an Arabic result for each step, matching step counts and preserved numeric values. Explicit corrections live in `scripts/data/exercise-arabic-corrections.json`. These checks establish completeness, not coaching accuracy: all imported content remains `needs_review`, with translation provenance marked `machine_draft`. Arabic exercise details show the draft warning and an expandable English original. Coaches/admins must review terminology and movement classifications before marking guidance reviewed.

A local OPUS model sample was rejected for poor output and is not included in the snapshot. Final drafts were prepared from the public source text using Google Translate. The optional preparation script uses a public endpoint without a stability guarantee; it is not run during builds or by members. Its checkpoint stays under ignored artifacts. Production reads the checked-in snapshot/database records and requires no translation credentials or inference service. No member data was used for translation.

The 29 cardiovascular entries remain browseable references. Their Use button is disabled in the strength library, the detail sheet directs members to Cardio & HIIT, and database triggers reject their use in strength sets or program items. The strength program selector omits them. Non-cardio entries use initial bodyweight, weighted-repetition or timed classifications; assistance-load tracking and fine anatomical interpretation still need editorial review.

## Media and library behavior

Every source record retains pinned external poster/GIF URLs with Gym Visual attribution and the owner's existing licensing confirmation, separately from the MIT text provenance. Existing media resolvers use explicit source IDs. The current thumbnail and on-demand GIF playback flows are reused; no bulk media download or Supabase media bucket is introduced. External hosting availability still affects demonstrations, while cached written guidance remains usable under existing offline rules.

The member library initially renders 60 results and now offers Show more in batches of 60. Search and combined filters operate over the complete loaded catalogue, including Arabic names. Catalogue loading already paginates beyond server row limits. The larger text catalogue increases reference-data transfer and device-cache size as well as database storage; this is separate from image/GIF delivery.

## Reproduction and checks

```sh
# Regenerate deterministic SQL chunks from the checked-in public snapshots.
node scripts/build-exercise-catalogue.mjs
npm run test:catalogue
npm run test:security
npm run test:performance
npm test
npm run typecheck
npm run build
npm run build:pages
```

The migration must precede applying the generated `supabase/catalogue/catalogue-01.sql` through `catalogue-27.sql` in order. Apply through trusted database tooling; these files are not browser APIs and contain no credentials. Normal migrations remain independent of the optional content seed, while `test:catalogue` replays both against isolated Postgres. The main database suite includes that check.

Verification covers complete source and Arabic coverage, numeric preservation, original identity/measurement preservation, repeat imports, coach edits/archives, member read/write rules and cardio rejection. Targeted mobile browser checks cover the full catalogue beyond 1,000 rows, Show more, Arabic-name search, disabled cardio selection and existing timed-guidance/reload behavior. Browser checks use mocked responses; hosted verification is read-only after the authorized seed. Human exercise review and physical-device demonstration acceptance remain separate.
