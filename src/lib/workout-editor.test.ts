import { describe, expect, it } from "vitest";
import { appendSet, emptyWorkout } from "./workout-store";
import {
  deleteWorkoutSets,
  editWorkoutSet,
  restoreWorkoutSets,
  sameSetWrite,
  workoutSlots,
  workingCount,
  prescribedReps,
  initializePlannedRows,
  updatePlannedRow,
  completePlannedRow,
  slotDraftKey,
  pairSuperset,
  supersetPair,
  nextSupersetSlot,
  slotReference,
  togglePlannedHold,
} from "./workout-editor";

function fixture() {
  const w = emptyWorkout("member");
  w.exercises = [
    { id: "bench", name_en: "Bench", name_ar: null, muscle: "chest", equipment: "barbell" },
  ];
  w.session = {
    id: "session",
    member_id: "member",
    started_at: new Date().toISOString(),
    title: "Test",
    synced: true,
  };
  return appendSet(w, { exercise_id: "bench", reps: 5, weight_kg: 50, rpe: 7, slot_key: "first" });
}
describe("workout editor", () => {
  it("merges independently edited fields without replacing a newer weight draft", () => {
    let w = fixture();
    w.plan = [{ id: "bench", slot_key: "first", sets: 2, reps: "8-12" }];
    w = initializePlannedRows(w, "bench", "first", {
      reps: "8",
      weight: "50",
      rpe: "",
      units: "metric",
    });
    const key = slotDraftKey("bench", "first"),
      row = w.editor!.plannedRows![key]![0]!;
    w = updatePlannedRow(w, key, row.id, { weight: "22.5", units: "metric" });
    w = updatePlannedRow(w, key, row.id, { reps: "10", units: "metric" });
    expect(w.editor!.plannedRows![key]![0]!.draft).toMatchObject({ weight: "22.5", reps: "10" });
    w = updatePlannedRow(w, key, row.id, { weight: "" });
    expect(w.editor!.plannedRows![key]![0]!.draft.weight).toBe("");
    expect(w.plan[0]!.reps).toBe("8-12");
  });
  it("resumes a planned hold from a persisted timestamp and captures only its own row", () => {
    let w = fixture();
    w.plan = [{ id: "bench", slot_key: "first", sets: 3, reps: "30" }];
    w = initializePlannedRows(w, "bench", "first", {
      reps: "30",
      weight: "",
      rpe: "",
      units: "metric",
    });
    const key = slotDraftKey("bench", "first"),
      rows = w.editor!.plannedRows![key]!;
    w = togglePlannedHold(w, key, rows[0]!.id, 1000);
    expect(w.holdStartedAt).toBe(1000);
    expect(() => togglePlannedHold(w, key, rows[1]!.id, 2000)).toThrow("current hold");
    const resumed = togglePlannedHold(structuredClone(w), key, rows[0]!.id, 4500);
    expect(resumed.holdStartedAt).toBeNull();
    expect(resumed.editor!.plannedRows![key]![0]!.draft.reps).toBe("3");
    expect(resumed.editor!.plannedRows![key]![1]!.draft.reps).toBe("30");
  });
  it("keeps each pending target editable and consumes it only once", () => {
    let w = fixture();
    w.plan = [{ id: "bench", slot_key: "first", sets: 3, reps: "8-12" }];
    w = initializePlannedRows(w, "bench", "first", {
      reps: "8",
      weight: "50",
      rpe: "",
      units: "metric",
    });
    const key = slotDraftKey("bench", "first"),
      pending = w.editor!.plannedRows![key]!;
    expect(pending.map((r) => r.number)).toEqual([2, 3]);
    const edited = { ...pending[1]!.draft, weight: "55", reps: "11" };
    w = updatePlannedRow(w, key, pending[1]!.id, edited);
    expect(w.editor!.plannedRows![key]![0]!.draft.weight).toBe("50");
    expect(() =>
      completePlannedRow(w, "bench", "first", pending[1]!.id, pending[1]!.draft, "metric"),
    ).toThrow("changed");
    w = completePlannedRow(w, "bench", "first", pending[1]!.id, edited, "metric");
    expect(w.sets.at(-1)).toMatchObject({
      reps: 11,
      weight_kg: 55,
      slot_key: "first",
      sync: "pending",
    });
    expect(w.editor!.plannedRows![key]!.map((r) => r.id)).toEqual([pending[0]!.id]);
    expect(() => completePlannedRow(w, "bench", "first", pending[1]!.id, edited, "metric")).toThrow(
      "already completed",
    );
    expect(
      initializePlannedRows(w, "bench", "first", edited).editor!.plannedRows![key],
    ).toHaveLength(1);
  });
  it("pairs repeated exercises by slot, advances A1 to A2, and rejects ambiguous legacy groups", () => {
    const w = fixture();
    w.exercises = [
      { id: "bench", name_en: "Bench", name_ar: null, muscle: "chest", equipment: "barbell" },
    ];
    w.plan = [
      { id: "bench", slot_key: "first", sets: 3, reps: "8" },
      { id: "bench", slot_key: "second", sets: 2, reps: "12" },
    ];
    const a = slotReference("bench", "first"),
      b = slotReference("bench", "second");
    const paired = pairSuperset(w, a, b);
    expect(supersetPair(paired)).toEqual([a, b]);
    expect(nextSupersetSlot(paired, "bench", "first")).toMatchObject({
      rest: false,
      next: { key: "second" },
    });
    expect(nextSupersetSlot(paired, "bench", "second")).toMatchObject({
      rest: true,
      next: { key: "first" },
    });
    expect(() => pairSuperset(w, a, a)).toThrow();
    expect(supersetPair({ ...w, superset: ["bench", "bench"] })).toEqual([]);
    expect(supersetPair(pairSuperset(paired, a, ""))).toEqual([]);
  });
  it("prefills only explicit prescriptions and supports Arabic digits", () => {
    expect(prescribedReps("8-12")).toBe("8");
    expect(prescribedReps("٨–١٢")).toBe("8");
    expect(prescribedReps("30", true)).toBe("30");
    expect(prescribedReps("AMRAP")).toBe("");
    expect(prescribedReps("3 x 10")).toBe("");
    expect(prescribedReps("0")).toBe("");
  });
  it("edits the same identity, validates values and rejects stale or finished edits", () => {
    const w = fixture(),
      row = w.sets[0]!;
    const next = editWorkoutSet(w, row.id, 0, {
      reps: 8,
      duration_seconds: null,
      weight_kg: 55,
      rpe: 8,
    });
    expect(next.sets[0]).toMatchObject({
      id: row.id,
      reps: 8,
      weight_kg: 55,
      sync: "pending",
      localRevision: 1,
    });
    expect(() => editWorkoutSet(next, row.id, 0, { reps: 9, weight_kg: 55, rpe: 8 })).toThrow(
      "another tab",
    );
    expect(() => editWorkoutSet(w, row.id, 0, { reps: 0, weight_kg: 50, rpe: null })).toThrow();
    expect(() =>
      editWorkoutSet({ ...w, phase: "finishing" }, row.id, 0, {
        reps: 8,
        weight_kg: 50,
        rpe: null,
      }),
    ).toThrow();
  });
  it("deletes a root and its drops and can undo after server acknowledgement removed them", () => {
    const w = fixture(),
      root = w.sets[0]!;
    const grouped = appendSet(w, {
      exercise_id: "bench",
      reps: 10,
      weight_kg: 30,
      rpe: null,
      slot_key: "first",
      set_role: "drop",
      root_set_id: root.id,
      segment_index: 1,
    });
    const deleted = deleteWorkoutSets(grouped, root.id);
    expect(deleted.sets.every((s) => s.sync === "deleted")).toBe(true);
    const restored = restoreWorkoutSets({ ...deleted, sets: [] }, grouped.sets);
    expect(restored.sets.map((s) => s.id)).toEqual(grouped.sets.map((s) => s.id));
    expect(restored.sets.every((s) => s.sync === "pending")).toBe(true);
    expect(() => restoreWorkoutSets(restored, grouped.sets)).toThrow("already changed");
  });
  it("does not acknowledge a newer edit or undo with an older request", () => {
    const w = fixture(),
      sent = w.sets[0]!;
    expect(sameSetWrite(sent, sent)).toBe(true);
    expect(sameSetWrite({ ...sent, reps: 9 }, sent)).toBe(false);
    expect(sameSetWrite({ ...sent, localRevision: 2 }, sent)).toBe(false);
    expect(sameSetWrite({ ...sent, sync: "deleted" }, sent)).toBe(false);
  });
  it("keeps duplicate exercise slots and swapped historical sets distinct", () => {
    const w = fixture();
    w.plan = [
      { id: "row", slot_key: "first", sets: 3, reps: "8–12" },
      { id: "bench", slot_key: "second", sets: 2, reps: "5" },
    ];
    expect(workoutSlots(w).map((p) => `${p.id}:${p.key}`)).toEqual([
      "row:first",
      "bench:second",
      "bench:first",
    ]);
  });
  it("excludes warmups and drops and labels partial unilateral work through its count", () => {
    const row = fixture().sets[0]!;
    expect(
      workingCount([
        { ...row, set_role: "warmup" },
        { ...row, set_role: "drop" },
        { ...row, side: "left" },
      ]),
    ).toBe(0.5);
  });
});
