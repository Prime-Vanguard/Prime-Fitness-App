// Badge artwork lives in design/Prime-Fitness-Badges; scripts/prepare-badges.mjs exports it here.
const files = import.meta.glob<string>("../assets/badges/*.webp", {
  eager: true,
  import: "default",
});

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"] as const;
export type Rarity = (typeof RARITIES)[number];

// ponytail: rarity is a client-side map; move it to the badges table when admins can add badges.
const rarity: Record<string, Rarity> = {
  first_workout: "common",
  first_food: "common",
  first_body: "common",
  first_pv: "uncommon",
  workouts_10: "uncommon",
  food_30: "rare",
  workouts_50: "epic",
  workouts_100: "legendary",
};

export const RARITY_LABEL: Record<Rarity, readonly [string, string]> = {
  common: ["Common", "شائع"],
  uncommon: ["Uncommon", "غير شائع"],
  rare: ["Rare", "نادر"],
  epic: ["Epic", "ملحمي"],
  legendary: ["Legendary", "أسطوري"],
  mythic: ["Mythic", "خرافي"],
};

/** Rarity and artwork for a badge code; badges without artwork return `art: null`. */
export function badgeArt(code: string) {
  const at = (size: number) => files[`../assets/badges/${code}-${size}.webp`];
  const small = at(128),
    medium = at(256),
    large = at(512);
  return {
    rarity: rarity[code] ?? "common",
    art: small && medium && large ? { small, medium, large } : null,
  };
}

// Mirrors the milestone thresholds in public.xp_on_workout and public.xp_on_food.
const GOALS: Record<string, readonly [kind: string, goal: number]> = {
  workouts_10: ["workout", 10],
  workouts_50: ["workout", 50],
  workouts_100: ["workout", 100],
  food_30: ["nutrition_day", 30],
};

/** Progress toward a counted milestone badge, or null for one-step badges. */
export function badgeProgress(code: string, credits: ReadonlyMap<string, number>) {
  const g = GOALS[code];
  return g ? { done: Math.min(credits.get(g[0]) ?? 0, g[1]), goal: g[1] } : null;
}
