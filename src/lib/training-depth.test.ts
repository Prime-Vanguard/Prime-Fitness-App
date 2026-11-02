import { describe, it, expect } from "vitest";
import { activityDay, addDays } from "./dates";
import { discoverExercises, normalizeExercise } from "./exercise-guidance";
import {
  suggestTraining,
  setMetrics,
  validateSetDetails,
  type TrainingPolicy,
} from "./training-model";
import { contextSuggestion } from "./training-context";
const policy: TrainingPolicy = {
  rule: "double",
  working_sets: 2,
  reps_min: 8,
  reps_max: 12,
  duration_target: null,
  increment: 2.5,
  rpe_ceiling: 8,
  upper_limit: null,
  revision: 1,
  allow_imported: false,
};
const set = (reps = 12) => ({ reps, weight_kg: 40, rpe: 8 });
describe("training depth", () => {
  it("groups Cairo days correctly over winter, summer and midnight", () => {
    expect(activityDay("2026-10-25T22:30:00Z")).toBe("2026-10-26");
    expect(activityDay("2026-01-01T22:30:00Z")).toBe("2026-01-02");
    expect(activityDay("2026-07-01T21:30:00Z")).toBe("2026-07-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(() => addDays("2026-02-30", 1)).toThrow();
  });
  it("normalizes Arabic search and combines equipment/muscle filters", () => {
    expect(normalizeExercise("أَرْجُل")).toBe("ارجل");
    const exercises = [
      {
        id: "a",
        name_en: "Squat",
        name_ar: "قرفصاء",
        muscle: "quads",
        equipment: "barbell",
        equipment_tags: ["barbell"],
        aliases: ["back squat"],
      },
      {
        id: "b",
        name_en: "Squat machine",
        name_ar: null,
        muscle: "quads",
        equipment: "machine",
        equipment_tags: ["machine"],
      },
    ];
    expect(
      discoverExercises(exercises, "back squat", { equipment: "barbell", muscle: "quads" }).map(
        (e) => e.id,
      ),
    ).toEqual(["a"]);
    expect(discoverExercises(exercises, "squat").map((e) => e.id)).toEqual(["a", "b"]);
  });
  it("advances load only after all working sets hit the range ceiling", () => {
    expect(suggestTraining(policy, [set(), set()])).toMatchObject({
      action: "advance",
      weight_kg: 42.5,
      reps: 8,
    });
    expect(suggestTraining(policy, [set(8), set(9)])).toMatchObject({ weight_kg: 40, reps: 9 });
  });
  it.each([
    [[set()]],
    [[set(7), set()]],
    [[set(), { ...set(), rpe: null }]],
    [[set(), { ...set(), rpe: 9 }]],
    [[set(), { ...set(), weight_kg: 42.5 }]],
  ])("holds incomplete, missed, missing/high effort and mixed-load performances", (sets) => {
    expect(suggestTraining(policy, sets as ReturnType<typeof set>[]).action).toBe("hold");
  });
  it("does not invent a baseline, progress warmups, or exceed a coach limit", () => {
    expect(suggestTraining(policy, []).action).toBe("baseline");
    expect(suggestTraining(policy, [{ ...set(), set_role: "warmup" }]).action).toBe("baseline");
    expect(suggestTraining({ ...policy, upper_limit: 41 }, [set(), set()]).action).toBe("hold");
    expect(suggestTraining({ ...policy, rule: "off" }, [set(), set()]).action).toBe("off");
  });
  it("requires matching left and right sides for every working pair", () => {
    const pair = "00000000-0000-4000-8000-000000000001";
    const p = { ...policy, working_sets: 1 };
    expect(suggestTraining(p, [{ ...set(), side: "left", pair_id: pair }]).action).toBe("hold");
    expect(
      suggestTraining(p, [
        { ...set(), side: "left", pair_id: pair },
        { ...set(), side: "right", pair_id: pair },
      ]).action,
    ).toBe("advance");
  });
  it("advances duration without producing an estimated 1RM", () => {
    const p = { ...policy, rule: "duration" as const, duration_target: 30, increment: 5 };
    const holds = [
      { ...set(), reps: null, duration_seconds: 30, logging_mode: "timed" as const },
      { ...set(), reps: null, duration_seconds: 30, logging_mode: "timed" as const },
    ];
    expect(suggestTraining(p, holds)).toMatchObject({ action: "advance", duration_seconds: 35 });
    expect(setMetrics(holds[0]!)).toMatchObject({ seconds: 30, kg: 0 });
  });
  it("calculates per-hand and unilateral external-load volume without doubling sides", () => {
    expect(setMetrics({ ...set(10), weight_kg: 20, load_convention: "per_hand" })).toEqual({
      kg: 400,
      sets: 1,
      seconds: 0,
    });
    expect(
      setMetrics({ ...set(10), weight_kg: 20, load_convention: "per_hand", side: "left" }),
    ).toEqual({ kg: 200, sets: 0.5, seconds: 0 });
    expect(setMetrics({ ...set(10), set_role: "warmup" })).toEqual({ kg: 0, sets: 0, seconds: 0 });
    expect(setMetrics({ ...set(10), set_role: "drop" })).toEqual({ kg: 400, sets: 0, seconds: 0 });
  });
  it("rejects invalid set relationships and wrong measurement fields", () => {
    expect(() =>
      validateSetDetails({ ...set(), logging_mode: "timed", duration_seconds: 30 }),
    ).toThrow();
    expect(() => validateSetDetails({ ...set(), side: "left" })).toThrow();
    expect(() => validateSetDetails({ ...set(), set_role: "drop" })).toThrow();
    expect(
      validateSetDetails({ ...set(), reps: null, logging_mode: "timed", duration_seconds: 30 })
        .duration_seconds,
    ).toBe(30);
  });
  it("keeps a coach override until a complete subsequent performance", () => {
    const p = {
      ...policy,
      updated_at: "2026-10-20T10:00:00Z",
      exercise_id: "squat",
      override: { reason: "Coach target", weight_kg: 35, reps: 10, duration_seconds: null },
    };
    const expected = {
      logging_mode: "weighted_reps" as const,
      load_convention: "external_total" as const,
    };
    expect(contextSuggestion({ policy: p, session: null, sets: [], expected }).action).toBe(
      "override",
    );
    expect(
      contextSuggestion({
        policy: p,
        expected,
        session: { id: "s", finished_at: "2026-10-21T10:00:00Z" },
        sets: [set(), set()],
      }).action,
    ).toBe("advance");
    expect(
      contextSuggestion({
        policy: p,
        session: null,
        sets: [{ ...set(), load_convention: "per_hand" }],
        expected,
      }).action,
    ).toBe("baseline");
    const pair = crypto.randomUUID();
    expect(
      contextSuggestion({
        policy: { ...p, working_sets: 1 },
        session: { id: "s", finished_at: "2026-10-21T10:00:00Z" },
        expected,
        sets: [
          { ...set(), side: "left", pair_id: pair },
          { ...set(), side: "left", pair_id: crypto.randomUUID() },
        ],
      }).action,
    ).toBe("override");
    expect(
      contextSuggestion({ policy: { ...p, rule: "off" }, session: null, sets: [], expected })
        .action,
    ).toBe("off");
    expect(contextSuggestion({ policy: p, session: null, sets: [] }).action).toBe("baseline");
  });
});
