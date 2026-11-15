import type { Workout } from "./workout-store";
import { workingCount } from "./workout-editor";
import { setMetrics } from "./training-model";

/** A device-only presentation receipt, never evidence for rewards or progression. */
export type WorkoutCompletion = {
  id: string;
  title: string | null;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  exercises: number;
  loggedSets: number;
  workingSets: number;
  volumeKg: number;
  holdSeconds: number;
};

/** Called only after server acceptance, before clearing the matching durable draft. */
export function workoutCompletion(workout: Workout): WorkoutCompletion | undefined {
  if (!workout.session || workout.phase !== "finishing" || !workout.finishedAt) return;
  const start = Date.parse(workout.session.started_at),
    end = Date.parse(workout.finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
  const sets = workout.sets.filter((set) => set.sync !== "deleted");
  const totals = sets.reduce(
    (sum, set) => {
      const metric = setMetrics({
        reps: set.reps,
        weight_kg: set.weight_kg,
        set_role: set.set_role ?? "working",
        side: set.side ?? "bilateral",
        logging_mode: set.logging_mode ?? "weighted_reps",
        duration_seconds: set.duration_seconds ?? null,
        load_convention: set.load_convention ?? "external_total",
      });
      return { kg: sum.kg + metric.kg, seconds: sum.seconds + metric.seconds };
    },
    { kg: 0, seconds: 0 },
  );
  return {
    id: workout.session.id,
    title: workout.session.title,
    startedAt: workout.session.started_at,
    finishedAt: workout.finishedAt,
    durationSeconds: Math.floor((end - start) / 1000),
    exercises: new Set(sets.map((set) => `${set.exercise_id}:${set.slot_key ?? ""}`)).size,
    loggedSets: sets.length,
    workingSets: workingCount(sets),
    volumeKg: totals.kg,
    holdSeconds: totals.seconds,
  };
}
