import { setMetrics, type PerformanceSet } from "./training-model";
export const MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "core",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
] as const;
export type Muscle = (typeof MUSCLES)[number];
export function muscleGroup(raw: string): Muscle | null {
  const value = raw.toLowerCase().trim();
  if (MUSCLES.includes(value as Muscle)) return value as Muscle;
  if (/chest|pect/.test(value)) return "chest";
  if (/back|lat|trap/.test(value)) return "back";
  if (/shoulder|delt/.test(value)) return "shoulders";
  if (/bicep|arms/.test(value)) return "biceps";
  if (/tricep/.test(value)) return "triceps";
  if (/quad|legs/.test(value)) return "quads";
  if (/hamstring/.test(value)) return "hamstrings";
  if (/glute/.test(value)) return "glutes";
  if (/calf|calves/.test(value)) return "calves";
  if (/core|abs|abdom/.test(value)) return "core";
  return null;
}
export function muscleVolume(
  sets: (PerformanceSet & { exercise_id: string; muscle?: string })[],
  exercises: { id: string; muscle: string }[],
) {
  const result = Object.fromEntries(
    MUSCLES.map((m) => [m, { sets: 0, kg: 0, seconds: 0 }]),
  ) as Record<Muscle, { sets: number; kg: number; seconds: number }>;
  let unmapped = 0;
  for (const set of sets) {
    const exercise = exercises.find((e) => e.id === set.exercise_id);
    const group = set.muscle
      ? muscleGroup(set.muscle)
      : exercise
        ? muscleGroup(exercise.muscle)
        : null;
    if (!group) {
      unmapped++;
      continue;
    }
    const metrics = setMetrics(set);
    result[group].sets += metrics.sets;
    result[group].kg += metrics.kg;
    result[group].seconds += metrics.seconds;
  }
  return { groups: result, unmapped };
}
