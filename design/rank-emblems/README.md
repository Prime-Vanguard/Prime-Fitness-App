# Approved Prime Vanguard base emblems

The six base designs were approved in chat before integration. [Approved concept](approved-concept.png) · [Production preview](production-preview.png) · [Interactive-size preview](preview.html).

## Artwork and provenance

- **Method:** built-in `image_gen`, editing the approved concept to extract each emblem with transparent alpha. No CLI/API fallback.
- **Full prompt set:** [prompts.json](prompts.json), including one prompt per emblem and the generated source filenames.
- **Original cutouts:** `source/recruit.png`, `source/seeker.png`, `source/forged.png`, `source/guardian.png`, `source/vanguard.png`, `source/prime-legend.png`.
- **App exports:** [`src/assets/ranks/`](../../src/assets/ranks/), six emblems at 128, 256 and 512 pixels. Eighteen transparent WebP files total **570 KiB**. The large PNG sources and review boards are not shipped in the app bundle.

`npm run rank:assets` uses installed Chrome through Playwright to resize/encode the approved sources, validate transparent corners and visible silhouettes, and regenerate the preview. It changes export size/encoding only; the artwork was produced by image generation. Re-exports can vary with the browser encoder version.

## Integration

`src/lib/rank-emblems.ts` maps the existing rank names to responsive assets. `RankCrest` uses localized alt text, explicit dimensions and `srcset`; all existing rank displays inherit the new artwork. Roadmap previews and level-up celebrations show larger emblems.

Achievement cards decode the same high-resolution emblem directly into the PNG canvas. The existing PWA build includes all hashed public asset exports automatically, so emblems and story export work offline after the cache finishes installing. No private responses or user media were added to the cache.

Rank names, level ranges, XP, PV, perks and reward-shop fulfillment are unchanged. This introduces the approved base artwork; cosmetic inventory and shop purchases are separate work.

## Verification

- Source transparency and all 18 export sizes are validated by `npm run rank:assets`.
- Production build, TypeScript, changed-file ESLint, 49 unit tests and all 19 mobile Chromium scenarios passed after integration.
- Browser coverage loads all six emblems, checks responsive sources and mobile width, verifies all 18 exports in the offline cache, and exports a 1080×1920 achievement PNG offline with visible emblem pixels.
