import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { EditorExercise } from "./admin-programs";
import { requireActiveAdmin } from "./admin-member-write";
import { fetchAll } from "./pagination";
import { safeExerciseAsset } from "./exercise-media";
import { sourceFromGuidance, type TextSource } from "./exercise-reference";
export type Alternative = Database["public"]["Tables"]["exercise_alternatives"]["Row"];
export type ExerciseForm = ReturnType<typeof exerciseForm>;
export async function loadExerciseCoverage(signal: AbortSignal) {
  const assignments = await fetchAll(
    (a, b) =>
      supabase
        .from("program_assignments")
        .select("id,program_version_id")
        .eq("active", true)
        .order("id")
        .range(a, b)
        .abortSignal(signal)
        .retry(false),
    (row) => row.id,
  );
  if (assignments.some((row) => !row.program_version_id))
    throw new Error("An active assignment has no frozen version. Coverage could not be verified.");
  const ids = [...new Set(assignments.map((row) => row.program_version_id!))],
    exercises = new Set<string>();
  for (let start = 0; start < ids.length; start += 100) {
    const group = ids.slice(start, start + 100);
    const versions = await fetchAll(
      (a, b) =>
        supabase
          .from("program_versions")
          .select("id,items")
          .in("id", group)
          .order("id")
          .range(a, b)
          .abortSignal(signal)
          .retry(false),
      (row) => row.id,
    );
    if (versions.length !== group.length)
      throw new Error("A frozen version is unavailable. Coverage could not be verified.");
    for (const version of versions) {
      if (!Array.isArray(version.items))
        throw new Error("Frozen exercise metadata is unavailable. Coverage could not be verified.");
      for (const item of version.items) {
        if (
          !item ||
          typeof item !== "object" ||
          Array.isArray(item) ||
          typeof item["exercise_id"] !== "string"
        )
          throw new Error(
            "Frozen exercise metadata is incomplete. Coverage could not be verified.",
          );
        exercises.add(item["exercise_id"]);
      }
    }
  }
  return exercises;
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function exerciseForm(row: EditorExercise) {
  const g = object(row.guidance),
    m = object(row.media),
    text = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    name_en: row.name_en,
    name_ar: row.name_ar ?? "",
    muscle: row.muscle,
    equipment: row.equipment ?? "",
    equipment_tags: (row.equipment_tags ?? []).join(", "),
    aliases: (row.aliases ?? []).join(", "),
    movement_pattern: row.movement_pattern ?? "",
    logging_mode: row.logging_mode ?? "weighted_reps",
    load_convention: row.load_convention ?? "external_total",
    steps_en: text(g["steps_en"]),
    steps_ar: text(g["steps_ar"]),
    cues_en: text(g["cues_en"]),
    cues_ar: text(g["cues_ar"]),
    mistakes_en: text(g["mistakes_en"]),
    mistakes_ar: text(g["mistakes_ar"]),
    url: text(m["url"]),
    poster: text(m["poster"]),
    author: text(m["author"]),
    source: text(m["source"]),
    license: text(m["license"]) || "original",
    permission: text(m["permission"]),
    attribution: text(m["attribution"]),
    kind: text(m["kind"]),
    reviewed: row.editorial_status === "reviewed",
  };
}
export const textSourceFor = (row: EditorExercise) => sourceFromGuidance(object(row.guidance));
const csv = (value: string) => [
  ...new Set(
    value
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];
export function exerciseIssues(form: ExerciseForm) {
  const issues: string[] = [];
  if (!form.steps_en.trim()) issues.push("English instructions");
  if (!form.steps_ar.trim()) issues.push("Arabic instructions");
  if (!csv(form.equipment_tags).length) issues.push("Equipment classification");
  if (!form.movement_pattern.trim()) issues.push("Movement classification");
  if (
    form.url.trim() &&
    (!form.author.trim() ||
      !form.source.trim() ||
      !form.permission.trim() ||
      !form.attribution.trim())
  )
    issues.push("Demonstration rights evidence");
  return issues;
}
export function exercisePayload(
  original: EditorExercise,
  form: ExerciseForm,
  textSource: TextSource | null,
) {
  if (
    !form.name_en.trim() ||
    form.name_en.trim().length > 200 ||
    form.name_ar.trim().length > 200 ||
    !form.muscle.trim() ||
    form.muscle.length > 100
  )
    throw new Error(
      "Enter an English exercise name and primary muscle; names may contain at most 200 characters.",
    );
  if (
    !["weighted_reps", "bodyweight_reps", "timed"].includes(form.logging_mode) ||
    !["external_total", "per_hand", "bodyweight"].includes(form.load_convention)
  )
    throw new Error("Choose a valid logging mode and load convention.");
  const guidance: Record<string, unknown> = {
    ...object(original.guidance),
    ...Object.fromEntries(
      ["steps_en", "steps_ar", "cues_en", "cues_ar", "mistakes_en", "mistakes_ar"].map((k) => [
        k,
        form[k as keyof ExerciseForm],
      ]),
    ),
    ...(textSource ? { text_source: textSource } : {}),
  };
  for (const value of Object.values(guidance))
    if (typeof value === "string" && value.length > 10000)
      throw new Error("Guidance fields must contain at most 10,000 characters.");
  let media: Record<string, unknown> | null = null;
  if (form.url.trim()) {
    if (!safeExerciseAsset(form.url.trim()) || !form.url.trim().startsWith("https://"))
      throw new Error("Use a valid HTTPS demonstration URL without embedded credentials.");
    if (!["original", "CC0", "CC-BY-4.0"].includes(form.license))
      throw new Error(
        "Choose a supported recorded media license. Catalogue reference previews are separate from member-approved media.",
      );
    if (exerciseIssues(form).includes("Demonstration rights evidence"))
      throw new Error(
        "Record author, source, permission evidence and member attribution before saving media.",
      );
    if (
      form.poster.trim() &&
      (!safeExerciseAsset(form.poster.trim()) ||
        !form.poster.trim().startsWith("https://") ||
        /\.gif(?:[?#]|$)/i.test(form.poster.trim()))
    )
      throw new Error("Use a static HTTPS poster URL.");
    media = {
      ...object(original.media),
      ...Object.fromEntries(
        ["url", "poster", "author", "source", "license", "permission", "attribution"].map((k) => [
          k,
          String(form[k as keyof ExerciseForm]).trim(),
        ]),
      ),
    };
    if (form.kind) media["kind"] = form.kind;
    else delete media["kind"];
  }
  if (form.reviewed && exerciseIssues(form).length)
    throw new Error(
      "Complete bilingual instructions, equipment, movement classification and any media rights before marking reviewed.",
    );
  return {
    name_en: form.name_en.trim(),
    name_ar: form.name_ar.trim() || null,
    muscle: form.muscle.trim().toLowerCase(),
    equipment: form.equipment.trim() || null,
    equipment_tags: csv(form.equipment_tags),
    aliases: csv(form.aliases),
    movement_pattern: form.movement_pattern.trim() || null,
    logging_mode: form.logging_mode,
    load_convention: form.load_convention,
    guidance: guidance as Json,
    media: media as Json | null,
    editorial_status: form.reviewed ? "reviewed" : "needs_review",
  };
}
export async function saveExercise(
  actor: string,
  original: EditorExercise,
  form: ExerciseForm,
  source: TextSource | null,
) {
  await requireActiveAdmin(actor);
  const payload = exercisePayload(original, form, source);
  const current = await supabase.from("exercises").select("*").eq("id", original.id).maybeSingle();
  if (current.error) throw current.error;
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value && typeof value === "object")
      return (
        "{" +
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
          .join(",") +
        "}"
      );
    return JSON.stringify(value);
  };
  if (
    current.data &&
    Object.entries(payload).every(
      ([k, v]) => canonical(current.data![k as keyof EditorExercise]) === canonical(v),
    )
  )
    return current.data;
  if (!current.data || current.data.updated_at !== original.updated_at)
    throw new Error("This exercise changed. Your draft is retained; reload before saving.");
  const result = await supabase
    .from("exercises")
    .update(payload)
    .eq("id", original.id)
    .eq("updated_at", original.updated_at)
    .select("*")
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data)
    throw new Error(
      "This exercise changed or saving was not allowed. Your draft is retained; reload and review again.",
    );
  return result.data;
}
export async function setExerciseActive(actor: string, original: EditorExercise, active: boolean) {
  await requireActiveAdmin(actor);
  const current = await supabase.from("exercises").select("*").eq("id", original.id).maybeSingle();
  if (current.error) throw current.error;
  if (current.data?.active === active) return current.data;
  const result = await supabase
    .from("exercises")
    .update({ active })
    .eq("id", original.id)
    .eq("updated_at", original.updated_at)
    .eq("active", original.active)
    .select("*")
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Exercise visibility changed. Reload before reviewing again.");
  return result.data;
}
export async function createExercise(
  actor: string,
  id: string,
  form: { name_en: string; name_ar: string; muscle: string; equipment: string },
  dispatch: () => void,
) {
  await requireActiveAdmin(actor);
  if (
    !form.name_en.trim() ||
    !form.muscle.trim() ||
    form.name_en.length > 200 ||
    form.name_ar.length > 200 ||
    form.muscle.length > 100
  )
    throw new Error("Enter a valid English name and primary muscle.");
  const payload = {
    name_en: form.name_en.trim(),
    name_ar: form.name_ar.trim() || null,
    muscle: form.muscle.trim().toLowerCase(),
    equipment: form.equipment.trim() || null,
    created_by: actor,
  };
  const existing = await supabase.from("exercises").select("*").eq("id", id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    if (Object.entries(payload).every(([k, v]) => existing.data![k as keyof EditorExercise] === v))
      return existing.data;
    throw new Error("This request already created a different exercise.");
  }
  dispatch();
  const result = await supabase
    .from("exercises")
    .insert({ id, ...payload })
    .select("*")
    .single();
  if (result.error) throw result.error;
  if (result.data?.id !== id)
    throw new Error("Exercise creation was not confirmed. Retry the same request.");
  return result.data;
}
export async function loadAlternatives(exercise: string, signal: AbortSignal) {
  return fetchAll(
    (a, b) =>
      supabase
        .from("exercise_alternatives")
        .select("*")
        .eq("exercise_id", exercise)
        .order("alternative_id")
        .range(a, b)
        .abortSignal(signal)
        .retry(false),
    (r) => r.alternative_id,
  );
}
export async function saveAlternative(
  actor: string,
  exercise: string,
  target: string,
  reasons: { en: string; ar: string },
  original: Alternative | null,
) {
  await requireActiveAdmin(actor);
  if (
    exercise === target ||
    !target ||
    !reasons.en.trim() ||
    !reasons.ar.trim() ||
    reasons.en.length > 2000 ||
    reasons.ar.length > 2000
  )
    throw new Error(
      "Choose a different exercise and give bilingual explanations of at most 2,000 characters.",
    );
  const ex = await supabase.from("exercises").select("active").eq("id", target).maybeSingle();
  if (ex.error) throw ex.error;
  if (!ex.data?.active && !original) throw new Error("Choose an active alternative.");
  const payload = {
    exercise_id: exercise,
    alternative_id: target,
    reason_en: reasons.en.trim(),
    reason_ar: reasons.ar.trim(),
  };
  const current = await supabase
    .from("exercise_alternatives")
    .select("*")
    .eq("exercise_id", exercise)
    .eq("alternative_id", target)
    .maybeSingle();
  if (current.error) throw current.error;
  if (current.data?.reason_en === payload.reason_en && current.data.reason_ar === payload.reason_ar)
    return current.data;
  if (
    (original &&
      (!current.data ||
        current.data.reason_en !== original.reason_en ||
        current.data.reason_ar !== original.reason_ar)) ||
    (!original && current.data)
  )
    throw new Error("This alternative changed. Reload before replacing its explanation.");
  const request = original
    ? supabase
        .from("exercise_alternatives")
        .update(payload)
        .eq("exercise_id", exercise)
        .eq("alternative_id", target)
        .eq("reason_en", original.reason_en)
        .eq("reason_ar", original.reason_ar)
        .select("*")
        .maybeSingle()
    : supabase.from("exercise_alternatives").insert(payload).select("*").single();
  const result = await request;
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Alternative was not confirmed. Your explanation is retained.");
  return result.data;
}
export async function deleteAlternative(actor: string, row: Alternative) {
  await requireActiveAdmin(actor);
  const current = await supabase
    .from("exercise_alternatives")
    .select("*")
    .eq("exercise_id", row.exercise_id)
    .eq("alternative_id", row.alternative_id)
    .maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) return;
  if (current.data.reason_en !== row.reason_en || current.data.reason_ar !== row.reason_ar)
    throw new Error("This alternative changed. Refresh before removing it.");
  const result = await supabase
    .from("exercise_alternatives")
    .delete()
    .eq("exercise_id", row.exercise_id)
    .eq("alternative_id", row.alternative_id)
    .eq("reason_en", row.reason_en)
    .eq("reason_ar", row.reason_ar)
    .select("alternative_id")
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data)
    throw new Error("Alternative removal was not confirmed. Refresh the alternatives.");
}
