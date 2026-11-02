import type { ImportWorkout } from "@/lib/training-import";
export type ImportExercise = { id: string; logging_mode: string; load_convention: string };
/** Pure preparation: keeps workout boundaries, stable set IDs and source provenance. */
export function prepareImportChunks(
  workouts: ImportWorkout[],
  mapping: Record<string, string>,
  exercises: readonly ImportExercise[],
) {
  const prepared = workouts
    .map((w) => ({
      ...w,
      sets: w.sets
        .filter((s) => mapping[s.source_exercise] !== "skip")
        .map((s) => {
          const { source_exercise, ...row } = s;
          const ex = exercises.find((e) => e.id === mapping[source_exercise]);
          if (!ex) throw new Error(`Map ${source_exercise} or explicitly exclude it.`);
          return {
            ...row,
            exercise_id: ex.id,
            load_convention: ex.load_convention,
            logging_mode: s.logging_mode === "timed" ? "timed" : ex.logging_mode,
          };
        }),
    }))
    .filter((w) => w.sets.length);
  const chunks: (typeof prepared)[] = [];
  let chunk: typeof prepared = [],
    count = 0;
  for (const w of prepared) {
    if (w.sets.length > 5000) throw new Error("One workout exceeds 5000 sets.");
    if (chunk.length >= 100 || count + w.sets.length > 5000) {
      chunks.push(chunk);
      chunk = [];
      count = 0;
    }
    chunk.push(w);
    count += w.sets.length;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
}
