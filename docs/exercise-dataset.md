# Exercise dataset integration — 28 October 2026

## Full catalogue update — 7 November 2026

All 1,324 source references now have a prepared database catalogue entry with English instructions, Arabic machine-translation drafts and external image/GIF URLs. Existing identities and measurement conventions are preserved; uncertain starter equivalents remain separate. See [full catalogue implementation and verification](full-exercise-catalogue.md) for the import, review status, storage measurements and deployment boundary. Media files remain externally hosted.

## Current status — 30 October 2026

The user subsequently confirmed licensing for the full Gym Visual catalogue and instructed use of the available image/GIF references. Member workout, program, discovery and history thumbnails now resolve the 1,324-entry pinned media catalogue, under the Exercise Guidance rollout flag. Unique exact name/equipment matches and explicit reference IDs are supported; uncertain matches keep an icon. Navy/silver/gold rendering uses a display filter without regenerating anatomy. GIF playback is on demand.

The catalogue resolver labels and credits Gym Visual media separately from MIT text, preserves written-guidance editorial status, does not create shared exercises or modify database approvals, and does not expose a catalogue-file download action. Media is fetched from pinned upstream URLs; managed hosting, offline media downloads and full mapping/content review remain future work. Generate the public reference manifest with `node scripts/build-exercise-visuals.mjs`.

The dated review below records the earlier internal-preview implementation. Its statements about missing authorization and preview-only member access describe October 28, before the user's later licensing confirmation; see [the current implementation report](ux-ui-implementation.md) for delivery and verification details.

## License review

Source: [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), pinned revision `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`.

The repository's LICENSE and NOTICE explicitly license exercise metadata and instruction text under MIT. Images and GIFs are © Gym visual and explicitly excluded. Repository permission does not transfer a media license to Prime Fitness. The copied LICENSE retains its media exception; the complete NOTICE is retained too.

Gym Visual's [terms](https://gymvisual.com/content/3-terms-and-conditions-of-use) describe licensed application use and modifications, but distinguish purchased assets from public previews and prohibit AI-derived content and downloadable redistribution. No license purchase or written permission was provided in this session. The user's request to proceed with branding is recorded as design authorization, not as evidence of third-party rights.

## Implemented

- 1,324 text references, English ordered instructions, equipment, target and supporting muscles. The upstream dataset has no Arabic instruction field; no Arabic translation or coach review is fabricated.
- Admin → Exercises → guidance editor → select an existing exercise → **Use MIT exercise text library**. Search and preview a candidate, then **Use draft English guidance**. This fills the English steps and equipment tags in the unsaved form and clears the reviewed checkbox. Existing Arabic instructions, load conventions, exercise IDs, program snapshots and alternatives remain under administrator control.
- Saving retains the source repository, revision and source exercise ID inside guidance JSON. Adapted guidance shows the source and MIT license in member details. Attribution remains even after editing the text.
- Dataset and preview-path manifests are fetched only when opened, not imported into initial JavaScript or the PWA installation list. No new database migration or permissions are needed.
- **Preview Prime Vanguard styling** shows the selected source illustration and, on request, GIF in a navy `#0F172A` / gold `#D4AF37` frame with the existing Prime Vanguard logo. An SVG filter renders neutral linework in silver and red source highlights in gold without regenerating anatomy or altering GIF frames. Original colors remain available for comparison. Preview dimensions remain 180 × 180. GIF playback begins only after an explicit click and can be stopped.
- Source media is fetched directly from the pinned upstream paths only after an administrator requests a preview; no bulk media files are vendored. Gym Visual attribution and the internal-preview status remain visible. The preview cannot save media into approved guidance or offer downloads. Member publication remains gated by the existing approved-media rules.

## Remaining media release gate

Obtain the appropriate Gym Visual license/written permission for the exact assets, modification and app delivery. Then record the evidence and implement that licensed delivery path without labeling proprietary media MIT, CC0 or CC BY. Do not send these assets to AI generation/editing services under the currently published terms.

The preview is an internal design review implementation, not a declaration that production redistribution rights have been obtained. A rights holder's written terms determine permissible use.

## Reproduction and checks

`node scripts/vendor-exercise-dataset.mjs` downloads only the pinned source JSON and legal notices. It emits an allowlisted text bundle and a separate manifest of upstream media paths. It validates source IDs, instructions and asset paths and fails if expected license markers disappear. Updates require explicitly reviewing a new revision and license terms.

`npx vitest run src/lib/exercise-reference.test.ts` validates record coverage, duplicate prevention, media separation, attribution provenance and search behavior. TypeScript, changed-file ESLint, production build and browser checks are recorded in the implementation report when run. No physical-device or human exercise-content acceptance is implied.

Verified on 28 October 2026: all 136 unit tests passed; the production build passed; targeted Chromium tests passed for the dataset/editor/preview workflow and existing timed-set guidance/reload workflow (2 cases). The preview test checks opt-in media requests, illustration/GIF switching, unreviewed draft state, retained MIT provenance and no approved-media assignment. It uses mocked Supabase responses, not a live member mutation. Two original source assets were downloaded to ignored `artifacts/exercise-preview-source/` solely for the requested local visual check; test fallback assets keep the test independent of those local files. The rendered preview was inspected at `artifacts/exercise-brand-preview.png`. These artifacts are outside the app's public/build assets.
