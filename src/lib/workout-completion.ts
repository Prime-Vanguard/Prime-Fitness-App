import type { Workout } from "./workout-store";
import { workingCount } from "./workout-editor";
import { setMetrics } from "./training-model";
import { MUSCLES, muscleVolume, type Muscle } from "./muscle-volume";
import { personalRecords } from "./records";

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
  // Optional so receipts saved before these fields existed still render.
  muscles?: { muscle: Muscle; sets: number }[];
  repRanges?: { strength: number; hypertrophy: number; endurance: number };
  topSets?: {
    exerciseId: string;
    name: string;
    nameAr: string | null;
    weightKg: number;
    reps: number;
    e1rm: number;
  }[];
};

/** Called only after server acceptance, before clearing the matching durable draft. */
export function workoutCompletion(workout: Workout): WorkoutCompletion | undefined {
  if (!workout.session || workout.phase !== "finishing" || !workout.finishedAt) return;
  const start = Date.parse(workout.session.started_at),
    end = Date.parse(workout.finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
  const sets = workout.sets.filter((set) => set.sync !== "deleted");
  const performance = sets.map((set) => ({
    exercise_id: set.exercise_id,
    created_at: set.created_at,
    reps: set.reps,
    weight_kg: set.weight_kg,
    set_role: set.set_role ?? "working",
    side: set.side ?? "bilateral",
    logging_mode: set.logging_mode ?? "weighted_reps",
    duration_seconds: set.duration_seconds ?? null,
    load_convention: set.load_convention ?? "external_total",
  }));
  const totals = performance.reduce(
    (sum, set) => {
      const metric = setMetrics(set);
      return { kg: sum.kg + metric.kg, seconds: sum.seconds + metric.seconds };
    },
    { kg: 0, seconds: 0 },
  );
  const { groups } = muscleVolume(performance, workout.exercises);
  const repRanges = { strength: 0, hypertrophy: 0, endurance: 0 };
  for (const set of performance)
    if (set.set_role === "working" && set.logging_mode !== "timed" && (set.reps ?? 0) > 0)
      repRanges[set.reps! <= 5 ? "strength" : set.reps! <= 12 ? "hypertrophy" : "endurance"]++;
  // Records compare one load convention only, matching Progress.
  const best = personalRecords(
    performance.filter((set) => set.load_convention === "external_total"),
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
    muscles: MUSCLES.filter((muscle) => groups[muscle].sets > 0)
      .map((muscle) => ({ muscle, sets: groups[muscle].sets }))
      .sort((a, b) => b.sets - a.sets),
    repRanges,
    topSets: [...best].map(([exerciseId, record]) => {
      const exercise = workout.exercises.find((item) => item.id === exerciseId);
      return {
        exerciseId,
        name: exercise?.name_en ?? "",
        nameAr: exercise?.name_ar ?? null,
        weightKg: record.bestWeight,
        reps: record.bestReps,
        e1rm: record.best1rm,
      };
    }),
  };
}
