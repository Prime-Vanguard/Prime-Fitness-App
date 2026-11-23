# Badge artwork prompts (ChatGPT image generation)

Draft, 2026-11-23. Every badge has its own artwork, and each rarity has its own frame
shape, material and finish, so a member can tell rarity at a glance.

## How to use

1. Open **one** new ChatGPT chat for all badges, so the style stays consistent.
2. Paste the **Style bible** first and send it. Wait for "Understood".
3. Generate the **tier reference sheet** next and keep the one you like. Upload it again
   if later badges drift from the style.
4. Paste one badge prompt at a time. Generate 2–4 versions and pick the best.
5. If an image contains letters, numbers or an eagle, ask: "Same badge, remove all text
   and the eagle."
6. Download each as PNG with a transparent background and name it by its code, for
   example `first_workout.png`. I will convert them to `128/256/512` WebP like the rank
   crests in `src/assets/ranks/`.
7. Do not generate locked versions. The app makes the dark locked silhouette itself.

## Style bible (paste first)

```
You are creating a set of achievement badges for "Prime Fitness", a premium fitness app.
I will send one badge at a time. Follow these rules for every image:

FORMAT
- Square 1024x1024, transparent background (PNG with alpha). No backdrop, no floor, no
  shadow plate, no vignette.
- One badge, centered, front view (not tilted), filling about 84% of the canvas with even
  padding on all sides.
- Must read clearly at 64x64 pixels: one bold central symbol, strong silhouette, high
  contrast between symbol and background field.

STYLE
- Premium game-achievement art: hand-forged metal, enamel, gems. Semi-realistic 3D render
  with crisp edges, like a high-end mobile RPG medal. Not cartoon, not flat vector, not
  photo.
- Brand palette: deep navy (#0F172A to #1E293B) enamel fields and royal gold (#D4AF37).
  Each rarity tier adds its own materials (I will specify).
- Lighting: soft key light from the top left, subtle rim light, gentle reflections.
  Same lighting on every badge.
- Theme: "The Forge" — strength earned through work: hammered metal, embers, anvils,
  heraldry. Dignified and motivating, never aggressive.

NEVER INCLUDE
- Any text, letters, numbers, Arabic or Latin script, logos or watermarks.
- Eagles or eagle wings (reserved for the app's rank crests).
- People, faces, body shapes, weighing scales, measuring tapes around waists, food junk,
  alcohol, gambling symbols, religious symbols, flags, weapons pointed at the viewer,
  skulls, blood.
- Neon colors, rainbow gradients, confetti.

RARITY TIERS (frame, material and finish change per tier; never reuse another tier's frame)
1. COMMON — "Iron Token": round hammered gunmetal coin, simple bevelled rim, matte finish,
   symbol stamped in raised steel on a navy enamel center. No gems, no glow.
2. UNCOMMON — "Bronze Seal": heater-shield shape in warm bronze with a riveted border and a
   faint teal patina in the recesses; two small laurel sprigs under the base; navy enamel
   field; symbol in polished bronze. One tiny amber spark. No gems.
3. RARE — "Silver Crest": tall hexagon in polished silver with fine engraved filigree; deep
   navy enamel field; symbol in bright silver with gold edging; one sky-blue gem (#7DD3FC)
   set at the top point; cool soft rim glow.
4. EPIC — "Gold Insignia": eight-point star frame in rich gold with layered bevels; navy
   enamel center; symbol in gold; four violet amethyst gems at the diagonal points; a few
   ember sparks drifting upward from the bottom edge; warm inner glow.
5. LEGENDARY — "Royal Medal": layered gold sunburst of long and short rays behind a round
   medallion; small crown at the top; crossed laurel branches at the base; deep navy enamel
   field; symbol in white-gold; clear diamond accents; strong warm halo glow.
6. MYTHIC — "Prime Relic": a floating artifact, not a medal. Obsidian-black core with molten
   gold veins glowing through cracks; a thin gold ring orbits it at an angle; small shards
   hover around the edge; symbol carved in light; faint iridescent sheen on the gold.

Reply "Understood" and wait for my first badge.
```

## Tier reference sheet (send second)

```
Create one reference sheet on a transparent background: six blank badge frames in a row,
left to right COMMON, UNCOMMON, RARE, EPIC, LEGENDARY, MYTHIC, exactly as described in the
style bible, each with an empty navy center (no symbol). Same size and lighting for all.
No text or labels.
```

## Current badges

These 8 badges already exist in the app (`supabase/migrations`). Rarity is assigned by
effort.

| Code | Name (EN / AR) | Unlock | Rarity |
| ---- | -------------- | ------ | ------ |
| `first_workout` | First Rep / أول تكرار | First workout | Common |
| `first_food` | Fuel Aware / واعٍ بوقوده | First food log | Common |
| `first_body` | Baseline Set / نقطة البداية | First body check | Common |
| `first_pv` | Vanguard Contributor / مساهم الطليعة | First approved PV task | Uncommon |
| `workouts_10` | Committed / ملتزم | 10 workouts | Uncommon |
| `food_30` | Nutrition Discipline / انضباط غذائي | Food logged on 30 days | Rare |
| `workouts_50` | Forged in Iron / مصقول بالحديد | 50 workouts | Epic |
| `workouts_100` | Centurion / المئوي | 100 workouts | Legendary |

### first_workout — First Rep (Common)

```
Badge: "First Rep". Tier: COMMON (Iron Token).
Symbol: a single dumbbell standing upright, slightly angled, with a small spark where it
first lifts off the ground. Simple and bold, like the first strike of a hammer.
Mood: a humble, proud beginning.
```

### first_food — Fuel Aware (Common)

```
Badge: "Fuel Aware". Tier: COMMON (Iron Token).
Symbol: a pomegranate cut open showing its seeds, with a small flame shape rising from
the top like fuel igniting. Clean, bold shapes.
Mood: awareness of what fuels you.
```

### first_body — Baseline Set (Common)

```
Badge: "Baseline Set". Tier: COMMON (Iron Token).
Symbol: a surveyor's flag planted on a small stone marker, with a horizontal level line
running behind it. No scales, no measuring tape, no body.
Mood: marking the starting point of a journey.
```

### first_pv — Vanguard Contributor (Uncommon)

```
Badge: "Vanguard Contributor". Tier: UNCOMMON (Bronze Seal).
Symbol: two hands clasped in a firm handshake (only hands and forearm cuffs, no faces),
in front of a small forge anvil.
Mood: contributing to the community and being recognized for it.
```

### workouts_10 — Committed (Uncommon)

```
Badge: "Committed". Tier: UNCOMMON (Bronze Seal).
Symbol: a heavy iron chain link closed around a vertical barbell bar, forming a strong
loop. Ten small rivets evenly spaced around the frame border.
Mood: a promise kept, the habit locked in.
```

### food_30 — Nutrition Discipline (Rare)

```
Badge: "Nutrition Discipline". Tier: RARE (Silver Crest).
Symbol: a wheat sheaf and an olive branch crossed in an X, bound at the center by a
small silver band, with a crescent of 30 tiny engraved dots arcing above them.
Mood: steady, daily discipline that adds up.
```

### workouts_50 — Forged in Iron (Epic)

```
Badge: "Forged in Iron". Tier: EPIC (Gold Insignia).
Symbol: a blacksmith's hammer striking a glowing barbell plate resting on an anvil, sparks
bursting from the point of impact. The plate glows orange-gold at the strike.
Mood: transformation through heat and repetition; you are being forged.
```

### workouts_100 — Centurion (Legendary)

```
Badge: "Centurion". Tier: LEGENDARY (Royal Medal).
Symbol: a classical crested centurion helmet seen from the front (empty, no face), with a
gold barbell laid horizontally across the medallion behind it.
Mood: a hundred battles won; elite and respected.
```

## Suggested new badges (optional)

These fill the higher tiers. Each needs a server rule and migration before it can be
earned, so generate the art only once you approve the badge.

| Code | Name (EN / AR, draft) | Unlock | Rarity |
| ---- | --------------------- | ------ | ------ |
| `streak_7` | Week Unbroken / أسبوع بلا انقطاع | 7-day streak | Uncommon |
| `first_best` | New Best / أفضل رقم جديد | First personal best | Uncommon |
| `campaigns_4` | Campaign Veteran / محارب الحملات | 4 weekly campaigns completed | Rare |
| `streak_30` | Eternal Flame / الشعلة الدائمة | 30-day streak | Epic |
| `workouts_250` | Iron Legion / فيلق الحديد | 250 workouts | Legendary |
| `level_100` | Prime Legend / أسطورة برايم | Reach Level 100 | Mythic |

### streak_7 — Week Unbroken (Uncommon)

```
Badge: "Week Unbroken". Tier: UNCOMMON (Bronze Seal).
Symbol: a torch with a steady flame, its handle wrapped by a ring of seven small bronze
beads, all lit with a tiny ember glow.
Mood: seven days of showing up.
```

### first_best — New Best (Uncommon)

```
Badge: "New Best". Tier: UNCOMMON (Bronze Seal).
Symbol: a barbell plate with an upward-pointing arrowhead cut through its center, the
arrow breaking past the rim of the plate.
Mood: you just beat your old self.
```

### campaigns_4 — Campaign Veteran (Rare)

```
Badge: "Campaign Veteran". Tier: RARE (Silver Crest).
Symbol: four small banners on poles arranged in a fan, each with a different simple shape
(dumbbell, leaf, flag, star) embroidered on it in gold thread.
Mood: a month of completed missions.
```

### streak_30 — Eternal Flame (Epic)

```
Badge: "Eternal Flame". Tier: EPIC (Gold Insignia).
Symbol: a tall flame burning inside an ornate gold brazier; the flame core is white-gold
and the outer flame deep orange, with embers rising.
Mood: a fire that never goes out.
```

### workouts_250 — Iron Legion (Legendary)

```
Badge: "Iron Legion". Tier: LEGENDARY (Royal Medal).
Symbol: three upright shields overlapping in a row, front one larger, each bearing a
small barbell emblem, in front of crossed gold barbells.
Mood: discipline at the level of an army.
```

### level_100 — Prime Legend (Mythic)

```
Badge: "Prime Legend". Tier: MYTHIC (Prime Relic).
Symbol: a crown of five tall points forged from molten gold, floating above an obsidian
anvil-shaped core with glowing gold veins; the orbiting ring passes behind the crown.
No eagle.
Mood: the peak of the journey, rare and legendary.
```

## Template for any new badge

```
Badge: "<Badge name>". Tier: <COMMON | UNCOMMON | RARE | EPIC | LEGENDARY | MYTHIC>
(<tier frame name>).
Symbol: <one concrete object or scene, described by shape; no text, no people>.
Mood: <one short line about what the member achieved>.
```

## Review checklist

- Rarity is obvious from the frame alone at 64px.
- No text, numbers, eagles or faces.
- Background is truly transparent (check on both navy and white).
- Symbol fills the center and is readable when shrunk.
- Lighting matches the rest of the set.
- Badge titles and Arabic names are drafts until the founder approves them.
