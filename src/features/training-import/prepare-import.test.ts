import { expect, it } from "vitest";
import type { ImportedSet, ImportWorkout } from "@/lib/training-import";
import { prepareImportChunks } from "./prepare-import";

const catalogue = [{ id: "bench", logging_mode: "weighted_reps", load_convention: "per_hand" }];
function workout(count = 1): ImportWorkout {
  return {
    title: "Source workout",
    activity_date: "2026-10-20",
    started_at: null,
    finished_at: null,
    source_rows: [{ Exercise: "Bench", Weight: "20" }],
    warnings: [],
    sets: Array.from({ length: count }, (_, index): ImportedSet => ({
      id: `set-${index}`,
      source_exercise: "Bench",
      exercise_id: "",
      set_number: index + 1,
      reps: 8,
      weight_kg: 20,
      rpe: 8,
      duration_seconds: null,
      logging_mode: "weighted_reps",
      set_role: "working",
      side: "bilateral",
      pair_id: null,
      root_set_id: null,
      segment_index: 0,
      load_convention: "external_total",
      slot_key: "",
    })),
  };
}

it("preserves source provenance and root/drop identities without modifying the preview", () => {
  const source = workout(2);
  Object.assign(source.sets[1]!, { set_role: "drop", root_set_id: "set-0", segment_index: 1 });
  const before = structuredClone(source);
  for (const set of source.sets) Object.freeze(set);
  Object.freeze(source.sets);
  Object.freeze(source);
  const submitted = prepareImportChunks([source], { Bench: "bench" }, catalogue)[0]![0]!;
  expect(source).toEqual(before);
  expect(submitted.source_rows).toEqual(source.source_rows);
  expect(submitted.started_at).toBeNull();
  expect(submitted.finished_at).toBeNull();
  expect(submitted.sets[1]).toMatchObject({
    id: "set-1",
    set_role: "drop",
    root_set_id: "set-0",
    segment_index: 1,
  });
  expect(submitted.sets[0]).not.toHaveProperty("source_exercise");
});

it("uses mapped conventions while retaining timed holds and bodyweight exercise modes", () => {
  const source = workout(2);
  Object.assign(source.sets[1]!, { logging_mode: "timed", reps: null, duration_seconds: 30 });
  const mapped = prepareImportChunks([source], { Bench: "body" }, [
    { id: "body", logging_mode: "bodyweight_reps", load_convention: "bodyweight" },
  ])[0]![0]!.sets;
  expect(mapped[0]).toMatchObject({
    exercise_id: "body",
    logging_mode: "bodyweight_reps",
    load_convention: "bodyweight",
  });
  expect(mapped[1]).toMatchObject({ logging_mode: "timed", duration_seconds: 30, reps: null });
});

it("omits explicitly excluded sets and fully excluded workouts without changing source rows", () => {
  const partial = workout(2);
  partial.sets[1]!.source_exercise = "Skip";
  const excluded = workout();
  excluded.sets[0]!.source_exercise = "Skip";
  const chunks = prepareImportChunks(
    [partial, excluded],
    { Bench: "bench", Skip: "skip" },
    catalogue,
  );
  expect(chunks).toHaveLength(1);
  expect(chunks[0]).toHaveLength(1);
  expect(chunks[0]![0]!.sets.map((set) => set.id)).toEqual(["set-0"]);
  expect(partial.sets).toHaveLength(2);
});

it("rejects unresolved and stale mappings instead of silently omitting workouts", () => {
  expect(() => prepareImportChunks([workout()], {}, catalogue)).toThrow("Map Bench");
  expect(() => prepareImportChunks([workout()], { Bench: "removed" }, catalogue)).toThrow(
    "Map Bench",
  );
});

it("caps a chunk at 100 workouts while preserving their order", () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({
    ...workout(),
    title: `Workout ${index}`,
  }));
  const chunks = prepareImportChunks(rows, { Bench: "bench" }, catalogue);
  expect(chunks.map((chunk) => chunk.length)).toEqual([100, 1]);
  expect(chunks.flat().map((row) => row.title)).toEqual(rows.map((row) => row.title));
});

it("caps chunks at 5000 sets without splitting a workout", () => {
  const chunks = prepareImportChunks(
    [workout(3000), workout(2000), workout(1)],
    { Bench: "bench" },
    catalogue,
  );
  expect(chunks.map((chunk) => chunk.map((row) => row.sets.length))).toEqual([[3000, 2000], [1]]);
});

it("rejects a single oversized workout before any commit can be dispatched", () => {
  expect(() => prepareImportChunks([workout(5001)], { Bench: "bench" }, catalogue)).toThrow(
    "One workout exceeds 5000 sets",
  );
});

it("creates no empty sentinel chunk for an empty or fully excluded import", () => {
  expect(prepareImportChunks([], {}, catalogue)).toEqual([]);
  expect(prepareImportChunks([workout()], { Bench: "skip" }, catalogue)).toEqual([]);
});
