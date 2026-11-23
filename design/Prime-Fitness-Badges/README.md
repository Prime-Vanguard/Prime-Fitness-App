# Prime Fitness badges

Approved 1024px transparent sources, one per badge code. Prompts and rarity tiers:
`docs/badge-art-prompts.md`.

To add or replace a badge:

1. Save the PNG here as `<badge code>.png`.
2. Add the code to `codes` in `scripts/prepare-badges.mjs` and its rarity in `src/lib/badges.ts`.
3. Run `node scripts/prepare-badges.mjs`. It writes `src/assets/badges/<code>-{128,256,512}.webp`
   and refreshes `production-preview.png`.

Glows, sheen, embers and the unlock animation are added in code (`.badge-art` in
`src/styles.css`); do not bake them into the artwork.
