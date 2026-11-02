import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { fetchAll } from "./pagination";
import { requireActiveAdmin } from "./admin-member-write";
import { inputNumber } from "./numeric-input";
export type Program = Database["public"]["Tables"]["programs"]["Row"];
export type ProgramItem = Database["public"]["Tables"]["program_items"]["Row"];
export type EditorExercise = Database["public"]["Tables"]["exercises"]["Row"];
export type ProgramVersion = Database["public"]["Tables"]["program_versions"]["Row"];
export type Assignment = Database["public"]["Tables"]["program_assignments"]["Row"];
export function programSearch(raw: Record<string, unknown>): {
  q?: string | undefined;
  program?: string | undefined;
  week?: number | undefined;
  day?: number | undefined;
} {
  const number = (value: unknown, max: number) =>
    Number.isSafeInteger(Number(value)) && Number(value) > 1 && Number(value) <= max
      ? Number(value)
      : undefined;
  return {
    q: typeof raw["q"] === "string" ? raw["q"].slice(0, 150) || undefined : undefined,
    program:
      typeof raw["program"] === "string" && /^[a-f0-9-]{36}$/i.test(raw["program"])
        ? raw["program"]
        : undefined,
    week: number(raw["week"], 52),
    day: number(raw["day"], 7),
  };
}
export async function loadPrograms(signal: AbortSignal) {
  return fetchAll(
    (a, b) =>
      supabase
        .from("programs")
        .select("*")
        .order("name")
        .order("id")
        .range(a, b)
        .abortSignal(signal)
        .retry(false),
    (r) => r.id,
  );
}
export async function loadEditorExercises(signal: AbortSignal) {
  return fetchAll(
    (a, b) =>
      supabase
        .from("exercises")
        .select("*")
        .order("name_en")
        .order("id")
        .range(a, b)
        .abortSignal(signal)
        .retry(false),
    (r) => r.id,
  );
}
export async function loadProgramItems(id: string, signal?: AbortSignal) {
  return fetchAll(
    (a, b) => {
      let query = supabase
        .from("program_items")
        .select("*")
        .eq("program_id", id)
        .order("id")
        .range(a, b);
      if (signal) query = query.abortSignal(signal);
      return query.retry(false);
    },
    (r) => r.id,
  );
}
export async function loadProgramVersions(id: string, signal: AbortSignal) {
  return fetchAll(
    (a, b) =>
      supabase
        .from("program_versions")
        .select("*")
        .eq("program_id", id)
        .order("version", { ascending: false })
        .order("id")
        .range(a, b)
        .abortSignal(signal)
        .retry(false),
    (r) => r.id,
  );
}
export async function loadProgramAssignments(id: string, signal: AbortSignal) {
  return fetchAll(
    (a, b) =>
      supabase
        .from("program_assignments")
        .select("*")
        .eq("program_id", id)
        .eq("active", true)
        .order("id")
        .range(a, b)
        .abortSignal(signal)
        .retry(false),
    (r) => r.id,
  );
}
export async function loadProgramMembers(signal: AbortSignal) {
  return fetchAll(
    (a, b) =>
      supabase
        .from("profiles")
        .select("id,display_name,email")
        .order("display_name")
        .order("id")
        .range(a, b)
        .abortSignal(signal)
        .retry(false),
    (r) => r.id,
  );
}
export function programInput(form: { name: string; description: string; weeks: string }) {
  const name = form.name.trim(),
    description = form.description.trim();
  if (!name || name.length > 200 || description.length > 2000)
    throw new Error(
      "Enter a program name of 1–200 characters and notes of at most 2,000 characters.",
    );
  const weeks = inputNumber(form.weeks, { label: "Weeks", min: 1, max: 52, integer: true });
  if (weeks == null) throw new Error("Enter the program length.");
  return { name, description: description || null, weeks };
}
export async function createProgram(
  actor: string,
  input: { id: string; name: string; description: string | null; weeks: number },
  dispatch: () => void,
) {
  await requireActiveAdmin(actor);
  const values = programInput({
    ...input,
    description: input.description ?? "",
    weeks: String(input.weeks),
  });
  const existing = await supabase.from("programs").select("*").eq("id", input.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    if (
      existing.data.name === values.name &&
      existing.data.description === values.description &&
      existing.data.weeks === values.weeks &&
      existing.data.created_by === actor
    )
      return existing.data;
    throw new Error("This request already created a different program. Reload the list.");
  }
  dispatch();
  const result = await supabase
    .from("programs")
    .insert({ id: input.id, ...values, created_by: actor })
    .select("*")
    .single();
  if (result.error) throw result.error;
  if (result.data?.id !== input.id)
    throw new Error("Program creation was not confirmed. Retry the same request.");
  return result.data;
}
export function itemInput(
  form: { exercise_id: string; target_sets: string; target_reps: string; position: string },
  week: number,
  day: number,
  weeks: number,
) {
  if (
    !form.exercise_id ||
    !Number.isInteger(week) ||
    week < 1 ||
    week > weeks ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 7
  )
    throw new Error("Choose a valid exercise and session.");
  const target_sets = inputNumber(form.target_sets, {
      label: "Working sets",
      min: 1,
      max: 100,
      integer: true,
    }),
    order = inputNumber(form.position, { label: "Order", min: 1, max: 100000, integer: true }),
    target_reps = form.target_reps.trim();
  if (target_sets == null || order == null || !target_reps || target_reps.length > 64)
    throw new Error("Enter set count, order and a target of 1–64 characters.");
  return {
    exercise_id: form.exercise_id,
    target_sets,
    target_reps,
    position: order - 1,
    week,
    day,
  };
}
const itemFields = [
  "program_id",
  "exercise_id",
  "week",
  "day",
  "target_sets",
  "target_reps",
  "position",
] as const;
export async function saveProgramItem(
  actor: string,
  id: string,
  program: Program,
  values: ReturnType<typeof itemInput>,
  original: ProgramItem | null,
) {
  await requireActiveAdmin(actor);
  itemInput(
    { ...values, target_sets: String(values.target_sets), position: String(values.position + 1) },
    values.week,
    values.day,
    program.weeks,
  );
  const ex = await supabase
    .from("exercises")
    .select("active")
    .eq("id", values.exercise_id)
    .maybeSingle();
  if (ex.error) throw ex.error;
  if (!ex.data?.active && values.exercise_id !== original?.exercise_id)
    throw new Error("Archived exercises cannot be added to a new slot.");
  const current = await supabase
    .from("program_items")
    .select("*")
    .eq("id", id)
    .eq("program_id", program.id)
    .maybeSingle();
  if (current.error) throw current.error;
  const payload = { program_id: program.id, ...values };
  if (current.data && itemFields.every((k) => current.data![k] === payload[k])) return current.data;
  if (original && (!current.data || itemFields.some((k) => current.data![k] !== original[k])))
    throw new Error("This exercise row changed. Your draft is retained; reload the session.");
  if (!original && current.data) throw new Error("This request already saved a different row.");
  let request;
  if (original) {
    let update = supabase.from("program_items").update(values).eq("id", id);
    for (const k of itemFields) update = update.eq(k, original[k]);
    request = update.select("*").maybeSingle();
  } else
    request = supabase
      .from("program_items")
      .insert({ id, ...payload })
      .select("*")
      .single();
  const result = await request;
  if (result.error) throw result.error;
  if (result.data?.id !== id)
    throw new Error("Exercise row was not confirmed. Your draft is retained.");
  return result.data;
}
export async function removeProgramItem(actor: string, row: ProgramItem) {
  await requireActiveAdmin(actor);
  const current = await supabase.from("program_items").select("*").eq("id", row.id).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) return;
  if (itemFields.some((k) => current.data![k] !== row[k]))
    throw new Error("This exercise row changed. Reload and review removal again.");
  let request = supabase.from("program_items").delete().eq("id", row.id);
  for (const k of itemFields) request = request.eq(k, row[k]);
  const result = await request.select("id").maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Removal was not confirmed. Refresh the session.");
}
export function programSnapshot(
  program: Program,
  items: ProgramItem[],
  exercises: EditorExercise[],
): Json {
  const used = new Set(items.map((r) => r.exercise_id));
  return {
    program: { ...program },
    items: [...items]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({ created_at: _created, ...row }) => row),
    exercises: exercises
      .filter((e) => used.has(e.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((e) => ({
        id: e.id,
        name_en: e.name_en,
        name_ar: e.name_ar,
        muscle: e.muscle,
        equipment: e.equipment,
        logging_mode: e.logging_mode,
        load_convention: e.load_convention,
      })),
  };
}
export async function reviewProgramAction(
  actor: string,
  program: Program,
  items: ProgramItem[],
  exercises: EditorExercise[],
  action: "copy" | "publish",
) {
  await requireActiveAdmin(actor);
  const result = await supabase.rpc("review_program_draft", {
    _program: program.id,
    _action: action,
    _expected: programSnapshot(program, items, exercises),
  });
  if (result.error) throw result.error;
  const data = result.data as { copied?: boolean; version_id?: string } | null;
  if (action === "copy") {
    if (!data?.copied) throw new Error("Copy was not confirmed. Retry the reviewed operation.");
  } else if (!data?.version_id)
    throw new Error("Publication was not confirmed. Retry the reviewed operation.");
  return data!;
}
export async function readActiveAssignment(member: string) {
  const result = await supabase
    .from("program_assignments")
    .select("*")
    .eq("member_id", member)
    .eq("active", true)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}
export async function assignReviewedVersion(
  actor: string,
  member: string,
  version: ProgramVersion,
  original: Assignment | null,
) {
  await requireActiveAdmin(actor);
  const result = await supabase.rpc("review_program_assignment", {
    _member: member,
    _version: version.id,
    _expected: original?.id ?? null,
  });
  if (result.error) throw result.error;
  const accepted = await readActiveAssignment(member);
  if (!accepted || accepted.id !== result.data || accepted.program_version_id !== version.id)
    throw new Error("Assignment was not confirmed. Retry the same reviewed version.");
  return accepted;
}
export async function removeAssignment(actor: string, original: Assignment) {
  await requireActiveAdmin(actor);
  const current = await readActiveAssignment(original.member_id);
  if (!current || current.id !== original.id) return;
  const result = await supabase
    .from("program_assignments")
    .update({ active: false })
    .eq("id", original.id)
    .eq("member_id", original.member_id)
    .eq("program_version_id", original.program_version_id!)
    .eq("active", true)
    .select("id")
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Assignment removal was not confirmed.");
}
