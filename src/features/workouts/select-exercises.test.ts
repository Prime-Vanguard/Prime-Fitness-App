import { describe, it, expect } from "vitest";
import { emptyWorkout, appendSet } from "@/lib/workout-store";
import { selectExercises } from "./select-exercises";

function fixture() {
  const workout = emptyWorkout("member");
  workout.session = {
    id: "session",
    member_id: "member",
    title: "Training",
    started_at: "2026-11-10T08:00:00Z",
    synced: false,
  };
  workout.exercises = ["bench", "row", "archived"].map((id) => ({
    id,
    name_en: id,
    name_ar: null,
    muscle: "back",
    equipment: "barbell",
    active: id !== "archived",
  }));
  return workout;
}
describe("atomic workout picker selection", () => {
  it("inserts a batch once with stable slots and keeps existing performance", () => {
    const previous = appendSet(fixture(), { exercise_id: "bench", reps: 8, weight_kg: 50, rpe: 7 });
    const choices = [
      { id: "bench", slot: "local:first" },
      { id: "row", slot: "local:second" },
    ];
    const result = selectExercises(previous, choices);
    expect(result.plan.map((item) => item.slot_key)).toEqual(["local:first", "local:second"]);
    expect(result.editor).toMatchObject({ selectedSlot: "local:first", selectedExercise: "bench" });
    expect(result.sets).toBe(previous.sets);
    expect(selectExercises(result, choices).plan).toEqual(result.plan);
    expect(previous.plan).toEqual([]);
  });
  it("rejects the whole batch if any choice is unavailable and guards workout state", () => {
    const previous = fixture();
    const choices = [
      { id: "bench", slot: "one" },
      { id: "archived", slot: "two" },
    ];
    expect(() => selectExercises(previous, choices)).toThrow("unavailable");
    expect(previous.plan).toEqual([]);
    expect(() => selectExercises({ ...previous, phase: "finishing" }, choices)).toThrow(
      "no longer editable",
    );
    expect(() => selectExercises({ ...previous, holdStartedAt: Date.now() }, choices)).toThrow(
      "Stop the current hold",
    );
  });
  it("replaces only the selected frozen slot and never changes logged sets", () => {
    const previous = appendSet(fixture(), { exercise_id: "bench", reps: 8, weight_kg: 50, rpe: 7 });
    previous.plan = [
      {
        id: "bench",
        slot_key: "frozen:first",
        program_version_id: "version",
        sets: 3,
        reps: "8–12",
      },
      { id: "bench", slot_key: "frozen:second", sets: 2, reps: "10" },
    ];
    previous.superset = ["bench", "row"];
    const result = selectExercises(previous, [{ id: "row", slot: "unused" }], {
      exercise: "bench",
      slot: "frozen:first",
    });
    expect(result.plan[0]).toMatchObject({
      id: "row",
      slot_key: "frozen:first",
      program_version_id: "version",
      sets: 3,
      reps: "8–12",
    });
    expect(result.plan[1]).toEqual(previous.plan[1]);
    expect(result.sets).toBe(previous.sets);
    expect(result.supersetSlots).toEqual([]);
    expect(() =>
      selectExercises(previous, [{ id: "row", slot: "unused" }], {
        exercise: "bench",
        slot: "missing",
      }),
    ).toThrow("slot has changed");
  });
  it("retains legacy unkeyed program targets when replacing an exercise", () => {
    const previous = fixture();
    previous.plan = [{ id: "bench", sets: 3, reps: "10" }];
    const result = selectExercises(previous, [{ id: "row", slot: "unused" }], {
      exercise: "bench",
      slot: "",
    });
    expect(result.plan[0]).toMatchObject({ id: "row", sets: 3, reps: "10" });
    expect(result.editor?.selectedSlot).toBe("");
    expect(previous.plan[0]?.id).toBe("bench");
    expect(() =>
      selectExercises(
        { ...previous, plan: [...previous.plan, ...previous.plan] },
        [{ id: "row", slot: "unused" }],
        { exercise: "bench", slot: "" },
      ),
    ).toThrow("slot has changed");
  });
  it("gives a legacy replacement its own stable slot when the target exercise already exists", () => {
    const previous = fixture();
    previous.plan = [
      { id: "bench", sets: 3, reps: "8" },
      { id: "row", sets: 2, reps: "12" },
    ];
    const choices = [{ id: "row", slot: "local:replacement" }];
    const replace = { exercise: "bench", slot: "" };
    const result = selectExercises(previous, choices, replace);
    expect(result.plan[0]).toMatchObject({
      id: "row",
      slot_key: "local:replacement",
      sets: 3,
      reps: "8",
    });
    expect(result.plan[1]).toEqual(previous.plan[1]);
    expect(result.editor?.selectedSlot).toBe("local:replacement");
    expect(selectExercises(result, choices, replace).plan).toEqual(result.plan);
  });
});
