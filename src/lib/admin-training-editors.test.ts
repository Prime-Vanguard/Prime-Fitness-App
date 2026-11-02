import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("./admin-member-write", () => ({ requireActiveAdmin: vi.fn() }));
import { supabase } from "@/integrations/supabase/client";
import { requireActiveAdmin } from "./admin-member-write";
import {
  exerciseForm,
  exerciseIssues,
  exercisePayload,
  saveExercise,
  saveAlternative,
  deleteAlternative,
  loadExerciseCoverage,
} from "./admin-exercises";
import {
  itemInput,
  programInput,
  programSearch,
  programSnapshot,
  reviewProgramAction,
  saveProgramItem,
  removeProgramItem,
  assignReviewedVersion,
  type EditorExercise,
  type Program,
  type ProgramItem,
  type ProgramVersion,
} from "./admin-programs";
const program: Program = {
  id: "program",
  name: "Plan",
  description: null,
  weeks: 3,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  created_by: "admin",
};
const exercise: EditorExercise = {
  id: "ex",
  name_en: "Press",
  name_ar: null,
  muscle: "chest",
  equipment: "barbell",
  active: true,
  aliases: [],
  equipment_tags: [],
  movement_pattern: null,
  logging_mode: "weighted_reps",
  load_convention: "external_total",
  guidance: {},
  media: null,
  editorial_status: "needs_review",
  instructions: null,
  media_url: null,
  created_at: program.created_at,
  updated_at: program.updated_at,
  created_by: "admin",
};
const item: ProgramItem = {
  id: "item",
  program_id: program.id,
  exercise_id: exercise.id,
  week: 1,
  day: 1,
  position: 0,
  target_sets: 3,
  target_reps: "8-12",
  created_at: program.created_at,
};
type Result = { data: unknown; error: unknown };
const ok = (data: unknown): Result => ({ data, error: null });
function mock(pages: Record<string, Result[]>) {
  const ops: unknown[][] = [];
  vi.mocked(supabase.from).mockImplementation((table) => {
    const result = pages[table]?.shift();
    if (!result) throw new Error(`Unexpected ${table}`);
    const query: Record<string, unknown> = {
      then: (resolve: (v: Result) => unknown) => Promise.resolve(result).then(resolve),
    };
    for (const method of [
      "select",
      "eq",
      "is",
      "insert",
      "update",
      "delete",
      "maybeSingle",
      "single",
      "range",
      "order",
      "in",
      "abortSignal",
      "retry",
    ])
      query[method] = (...args: unknown[]) => {
        ops.push([table, method, ...args]);
        return query;
      };
    return query as never;
  });
  return ops;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireActiveAdmin).mockResolvedValue(false);
});
it("loads one frozen snapshot per version rather than repeating it for every assigned member", async () => {
  const ops = mock({
    program_assignments: [
      {
        data: [
          { id: "a", program_version_id: "v" },
          { id: "b", program_version_id: "v" },
        ],
        error: null,
      },
      ok([]),
    ],
    program_versions: [
      { data: [{ id: "v", items: [{ exercise_id: "ex" }, { exercise_id: "ex" }] }], error: null },
      ok([]),
    ],
  });
  expect(await loadExerciseCoverage(new AbortController().signal)).toEqual(new Set(["ex"]));
  expect(ops.find((row) => row[0] === "program_versions" && row[1] === "in")).toEqual([
    "program_versions",
    "in",
    "id",
    ["v"],
  ]);
});
it("never reports zero coverage when an assigned frozen version cannot be read", async () => {
  mock({
    program_assignments: [{ data: [{ id: "a", program_version_id: "v" }], error: null }, ok([])],
    program_versions: [{ data: [], error: null }],
  });
  await expect(loadExerciseCoverage(new AbortController().signal)).rejects.toThrow(
    "could not be verified",
  );
});
it("never ignores incomplete frozen exercise metadata", async () => {
  mock({
    program_assignments: [{ data: [{ id: "a", program_version_id: "v" }], error: null }, ok([])],
    program_versions: [
      { data: [{ id: "v", items: [{ name_en: "Missing exercise identity" }] }], error: null },
      ok([]),
    ],
  });
  await expect(loadExerciseCoverage(new AbortController().signal)).rejects.toThrow(
    "metadata is incomplete",
  );
});
it("validates program lengths without silently clamping invalid input", () => {
  expect(programInput({ name: " Plan ", description: "", weeks: "٤" })).toEqual({
    name: "Plan",
    description: null,
    weeks: 4,
  });
  for (const weeks of ["4x", "0", "53", "1.5"])
    expect(() => programInput({ name: "Plan", description: "", weeks })).toThrow();
});
it("bounds session URL values and rejects malformed selections", () => {
  expect(programSearch({ week: 99, day: -1, program: "bad" })).toMatchObject({
    week: undefined,
    day: undefined,
    program: undefined,
  });
});
it("keeps prescribed target text and parses localized set/order counts", () => {
  expect(
    itemInput({ exercise_id: "ex", target_sets: "٣", target_reps: "30s", position: "٢" }, 2, 3, 3),
  ).toEqual({
    exercise_id: "ex",
    target_sets: 3,
    target_reps: "30s",
    position: 1,
    week: 2,
    day: 3,
  });
  expect(() =>
    itemInput({ exercise_id: "ex", target_sets: "0", target_reps: "8", position: "1" }, 1, 1, 3),
  ).toThrow();
});
it("normalizes preview ordering without changing caller rows", () => {
  const rows = [
    { ...item, id: "z" },
    { ...item, id: "a" },
  ];
  const snapshot = programSnapshot(program, rows, [exercise]) as { items: { id: string }[] };
  expect(snapshot.items.map((i) => i.id)).toEqual(["a", "z"]);
  expect(rows[0]!.id).toBe("z");
});
it("sends the reviewed complete snapshot to a guarded invoker RPC", async () => {
  vi.mocked(supabase.rpc).mockResolvedValue(ok({ version_id: "version" }) as never);
  await reviewProgramAction("admin", program, [item], [exercise], "publish");
  expect(supabase.rpc).toHaveBeenCalledWith("review_program_draft", {
    _program: program.id,
    _action: "publish",
    _expected: programSnapshot(program, [item], [exercise]),
  });
});
it("rejects unconfirmed publication responses", async () => {
  vi.mocked(supabase.rpc).mockResolvedValue(ok(null) as never);
  await expect(
    reviewProgramAction("admin", program, [item], [exercise], "publish"),
  ).rejects.toThrow("not confirmed");
});
it("requires fresh administrator access for program mutation", async () => {
  vi.mocked(requireActiveAdmin).mockRejectedValue(new Error("Access withdrawn"));
  await expect(reviewProgramAction("admin", program, [item], [exercise], "copy")).rejects.toThrow(
    "Access withdrawn",
  );
  expect(supabase.rpc).not.toHaveBeenCalled();
});
it("does not add an archived exercise to a new slot", async () => {
  const ops = mock({ exercises: [ok({ active: false })] });
  await expect(saveProgramItem("admin", "new", program, { ...item }, null)).rejects.toThrow(
    "Archived",
  );
  expect(ops.some((o) => o[1] === "insert")).toBe(false);
});
it("reconciles a saved slot and rejects a zero-row update", async () => {
  let ops = mock({ exercises: [ok({ active: true })], program_items: [ok(item)] });
  await saveProgramItem("admin", item.id, program, { ...item }, null);
  expect(ops.some((o) => o[1] === "insert")).toBe(false);
  ops = mock({ exercises: [ok({ active: true })], program_items: [ok(item), ok(null)] });
  await expect(
    saveProgramItem("admin", item.id, program, { ...item, target_sets: 4 }, item),
  ).rejects.toThrow("not confirmed");
  expect(ops).toContainEqual(["program_items", "eq", "target_sets", 3]);
});
it("does not remove a row edited after review", async () => {
  const ops = mock({ program_items: [ok({ ...item, target_sets: 5 })] });
  await expect(removeProgramItem("admin", item)).rejects.toThrow("changed");
  expect(ops.some((o) => o[1] === "delete")).toBe(false);
});
it("requires assignment readback to match its server receipt and reviewed version", async () => {
  const version = { id: "version", program_id: program.id } as ProgramVersion;
  vi.mocked(supabase.rpc).mockResolvedValue(ok("assignment") as never);
  mock({ program_assignments: [ok({ id: "other", program_version_id: version.id })] });
  await expect(assignReviewedVersion("admin", "member", version, null)).rejects.toThrow(
    "not confirmed",
  );
  expect(supabase.rpc).toHaveBeenCalledWith("review_program_assignment", {
    _member: "member",
    _version: "version",
    _expected: null,
  });
});
it("initializes each exercise independently without inheriting old guidance or media", () => {
  const first = exerciseForm({
      ...exercise,
      guidance: { steps_en: "Old guidance", steps_ar: "Old Arabic" },
      media: { url: "https://example.invalid/old.gif", license: "CC-BY-4.0" },
    }),
    second = exerciseForm({ ...exercise, id: "second" });
  expect(first.steps_en).toBe("Old guidance");
  expect(second.steps_en).toBe("");
  expect(second.steps_ar).toBe("");
  expect(second.url).toBe("");
  expect(second.license).toBe("original");
});
it("keeps text-only guidance valid and reports editorial gaps", () => {
  const form = {
    ...exerciseForm(exercise),
    steps_en: "Press",
    steps_ar: "اضغط",
    equipment_tags: "barbell",
    movement_pattern: "horizontal_push",
    reviewed: true,
  };
  expect(exerciseIssues(form)).toHaveLength(0);
  expect(exercisePayload(exercise, form, null).media).toBeNull();
  expect(() => exercisePayload(exercise, { ...form, steps_ar: "" }, null)).toThrow(
    "Complete bilingual",
  );
});
it("preserves unknown guidance metadata while editing known fields", () => {
  const original = {
    ...exercise,
    guidance: { editor_note: "Retain attribution", steps_en: "Before" },
  };
  expect(
    exercisePayload(original, { ...exerciseForm(original), steps_en: "After" }, null).guidance,
  ).toMatchObject({ editor_note: "Retain attribution", steps_en: "After" });
});
it("does not accept unsafe media URLs, missing rights, or GIF posters", () => {
  const form = { ...exerciseForm(exercise), url: "javascript:alert(1)" };
  expect(() => exercisePayload(exercise, form, null)).toThrow("HTTPS");
  expect(() =>
    exercisePayload(exercise, { ...form, url: "https://example.invalid/demo.gif" }, null),
  ).toThrow("Record author");
  expect(() =>
    exercisePayload(
      exercise,
      {
        ...form,
        url: "https://example.invalid/demo.gif",
        author: "Coach",
        source: "Original",
        permission: "Signed",
        attribution: "Coach",
        poster: "https://example.invalid/poster.gif",
      },
      null,
    ),
  ).toThrow("static HTTPS");
});
it("reconciles saved guidance after acknowledgement loss without another update", async () => {
  const form = { ...exerciseForm(exercise), steps_en: "New" },
    payload = exercisePayload(exercise, form, null);
  const ops = mock({ exercises: [ok({ ...exercise, ...payload, updated_at: "new" })] });
  await saveExercise("admin", exercise, form, null);
  expect(ops.some((o) => o[1] === "update")).toBe(false);
});
it("retains a stale exercise draft rather than overwriting a newer editor", async () => {
  const ops = mock({
    exercises: [ok({ ...exercise, name_en: "Another edit", updated_at: "new" })],
  });
  await expect(
    saveExercise("admin", exercise, { ...exerciseForm(exercise), name_en: "My edit" }, null),
  ).rejects.toThrow("changed");
  expect(ops.some((o) => o[1] === "update")).toBe(false);
});
it("rejects self alternatives and missing bilingual explanations", async () => {
  await expect(
    saveAlternative("admin", "same", "same", { en: "Why", ar: "Why" }, null),
  ).rejects.toThrow("different exercise");
  expect(supabase.from).not.toHaveBeenCalled();
});
it("does not overwrite a competing alternative explanation", async () => {
  const row = {
    exercise_id: "ex",
    alternative_id: "other",
    reason_en: "Original",
    reason_ar: "Original",
  };
  const ops = mock({
    exercises: [ok({ active: true })],
    exercise_alternatives: [ok({ ...row, reason_en: "Changed" })],
  });
  await expect(
    saveAlternative("admin", "ex", "other", { en: "Mine", ar: "Mine" }, row),
  ).rejects.toThrow("changed");
  expect(ops.some((o) => o[1] === "update")).toBe(false);
});
it("reconciles an already removed alternative without deleting again", async () => {
  const ops = mock({ exercise_alternatives: [ok(null)] });
  await deleteAlternative("admin", {
    exercise_id: "ex",
    alternative_id: "other",
    reason_en: "Why",
    reason_ar: "Why",
  });
  expect(ops.some((o) => o[1] === "delete")).toBe(false);
});
