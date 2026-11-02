export const PLATES_KG = [20, 15, 10, 5, 2.5, 1.25] as const;

export function plateLoad(total: number, bar = 20, available: readonly number[] = PLATES_KG) {
  if (!Number.isFinite(total) || !Number.isFinite(bar) || bar <= 0 || total < bar || total > 1000)
    return null;
  const target = Math.round(((total - bar) / 2) * 100);
  const sizes = [
    ...new Set(
      available.filter((n) => Number.isFinite(n) && n >= 0.01).map((n) => Math.round(n * 100)),
    ),
  ].sort((a, b) => b - a);
  const count = new Float64Array(target + 1).fill(Infinity);
  const chosen = new Int32Array(target + 1);
  count[0] = 0;
  // An exact combination may require skipping the largest available plate.
  for (let amount = 1; amount <= target; amount++) {
    for (const size of sizes) {
      if (size <= amount && count[amount - size]! + 1 < count[amount]!) {
        count[amount] = count[amount - size]! + 1;
        chosen[amount] = size;
      }
    }
  }
  let loaded = target;
  while (loaded > 0 && !Number.isFinite(count[loaded])) loaded--;
  const remainder = (target - loaded) / 50;
  const plates: number[] = [];
  while (loaded > 0) {
    const size = chosen[loaded]!;
    plates.push(size / 100);
    loaded -= size;
  }
  return { plates: plates.sort((a, b) => b - a), total: total - remainder, remainder };
}

export function warmupSets(working: number, bar = 20, increment = 2.5) {
  if (!Number.isFinite(working) || working <= bar || working > 1000) return [];
  const seen = new Set<number>();
  return [0, 0.5, 0.7, 0.9].flatMap((ratio, i) => {
    const weight = Math.max(bar, Math.floor((working * ratio - bar) / increment) * increment + bar);
    if (weight >= working || seen.has(weight)) return [];
    seen.add(weight);
    return [{ weight, reps: [10, 5, 3, 1][i] ?? 1 }];
  });
}

export type PlanItem = {
  id: string;
  sets: number;
  reps: string;
  slot_key?: string | undefined;
  program_version_id?: string | undefined;
  exercise?: Exercise | undefined;
};
export type Exercise = {
  id: string;
  name_en: string;
  name_ar: string | null;
  muscle: string;
  equipment: string | null;
  logging_mode?: "weighted_reps" | "bodyweight_reps" | "timed" | undefined;
  load_convention?: "external_total" | "per_hand" | "bodyweight" | undefined;
};

/** Frozen metadata overlays the catalogue without erasing its guidance/media. */
export function mergeExerciseSnapshots(catalogue: Exercise[], snapshots: Exercise[]): Exercise[] {
  const map = new Map(catalogue.map((exercise) => [exercise.id, exercise]));
  for (const snapshot of snapshots) map.set(snapshot.id, { ...map.get(snapshot.id), ...snapshot });
  return [...map.values()];
}

export function nextSupersetExercise(current: string, pair: readonly string[]) {
  return pair.length === 2 && current === pair[0]
    ? { next: pair[1]!, rest: false }
    : { next: pair[0] ?? current, rest: true };
}
