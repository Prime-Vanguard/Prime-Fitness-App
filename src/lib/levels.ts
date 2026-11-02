export const RANKS = [
  { key: "Recruit", ar: "مجنّد", min: 1, max: 15 },
  { key: "Seeker", ar: "الساعي", min: 16, max: 35 },
  { key: "Forged", ar: "المصقول", min: 36, max: 55 },
  { key: "Guardian", ar: "الحارس", min: 56, max: 75 },
  { key: "Vanguard", ar: "الطليعة", min: 76, max: 90 },
  { key: "Prime Legend", ar: "أسطورة برايم", min: 91, max: 100 },
] as const;

export function rankFor(level: number) {
  return RANKS.find((r) => level >= r.min && level <= r.max) ?? RANKS[0];
}

/** thresholds: cumulative XP required per level, sorted by level. */
export function levelFor(xp: number, thresholds: { level: number; xp_required: number }[]) {
  let level = 1;
  for (const t of thresholds) if (xp >= t.xp_required) level = Math.max(level, t.level);
  const cur = thresholds.find((t) => t.level === level)?.xp_required ?? 0;
  const next = thresholds.find((t) => t.level === level + 1)?.xp_required ?? null;
  const pct = next == null ? 1 : (xp - cur) / (next - cur);
  return { level, cur, next, pct };
}
