import { expect, it } from "vitest";
import { emptyWorkout, type Workout, type WorkoutSet } from "./workout-store";
import { workoutCompletion } from "./workout-completion";

function completed(): Workout {
  return {
    ...emptyWorkout("member"),
    phase: "finishing",
    finishedAt: "2026-11-12T11:00:00Z",
    session: {
      id: "session",
      member_id: "member",
      title: "Training",
      started_at: "2026-11-12T10:00:00Z",
      synced: true,
    },
  };
}
function set(patch: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: crypto.randomUUID(),
    member_id: "member",
    session_id: "session",
    exercise_id: "bench",
    set_number: 1,
    reps: 8,
    weight_kg: 20,
    rpe: 8,
    created_at: "2026-11-12T10:10:00Z",
    sync: "synced",
    ...patch,
  };
}
it("separates working count, external volume and timed work without deleted sets", () => {
  const result = workoutCompletion({
    ...completed(),
    sets: [
      set({ load_convention: "per_hand" }),
      set({ set_role: "warmup" }),
      set({ set_role: "drop" }),
      set({
        exercise_id: "hold",
        logging_mode: "timed",
        duration_seconds: 30,
        reps: null,
        weight_kg: null,
      }),
      set({ side: "left" }),
      set({ sync: "deleted", weight_kg: 999 }),
    ],
  });
  expect(result).toMatchObject({
    durationSeconds: 3600,
    loggedSets: 5,
    workingSets: 2.5,
    volumeKg: 640,
    holdSeconds: 30,
    exercises: 2,
  });
  expect(result).not.toHaveProperty("xp");
});
it("counts repeated exercise slots separately and rejects unfinished or invalid times", () => {
  const w = completed();
  expect(
    workoutCompletion({ ...w, sets: [set({ slot_key: "a" }), set({ slot_key: "b" })] })?.exercises,
  ).toBe(2);
  expect(workoutCompletion({ ...w, phase: "discarding" })).toBeUndefined();
  expect(workoutCompletion({ ...w, phase: "active" })).toBeUndefined();
  expect(workoutCompletion({ ...w, finishedAt: "invalid" })).toBeUndefined();
  expect(workoutCompletion({ ...w, finishedAt: "2026-11-11T10:00:00Z" })).toBeUndefined();
});

it("summarizes muscles, rep ranges and top sets from working sets only", () => {
  const result = workoutCompletion({
    ...completed(),
    exercises: [
      {
        id: "bench",
        name_en: "Bench Press",
        name_ar: "ضغط البنش",
        muscle: "Chest",
        equipment: "barbell",
      },
      { id: "squat", name_en: "Squat", name_ar: null, muscle: "Quads", equipment: "barbell" },
    ],
    sets: [
      set({ reps: 5, weight_kg: 80 }),
      set({ reps: 8, weight_kg: 70 }),
      set({ reps: 10, weight_kg: 200, set_role: "warmup" }),
      set({ exercise_id: "squat", reps: 15, weight_kg: 60 }),
      set({ exercise_id: "squat", reps: 3, weight_kg: 999, sync: "deleted" }),
    ],
  })!;
  expect(result.muscles).toEqual([
    { muscle: "chest", sets: 2 },
    { muscle: "quads", sets: 1 },
  ]);
  expect(result.repRanges).toEqual({ strength: 1, hypertrophy: 1, endurance: 1 });
  // 80 × 5 (e1RM 93.3) beats 70 × 8 (88.7); the warm-up never counts.
  expect(result.topSets?.find((top) => top.exerciseId === "bench")).toMatchObject({
    name: "Bench Press",
    weightKg: 80,
    reps: 5,
  });
});
