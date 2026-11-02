import { z } from "zod";
import { normalizeExercise, type ExerciseGuidance } from "./exercise-guidance";
export const referenceRevision = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd";
export const referenceRepository = "hasaneyldrm/exercises-dataset";
const text = z.string().trim().min(1).max(10000);
const entry = z
  .object({
    id: z.string().regex(/^\d{4}$/),
    name: text,
    body_part: text,
    equipment: text,
    target: text,
    secondary_muscles: z.array(text),
    steps_en: z.array(text).min(1),
  })
  .strict();
export const referenceSchema = z
  .object({
    repository: z.literal(referenceRepository),
    revision: z.literal(referenceRevision),
    license: z.literal("MIT"),
    source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    exercises: z
      .array(entry)
      .min(1)
      .max(5000)
      .refine(
        (rows) => new Set(rows.map((r) => r.id)).size === rows.length,
        "Duplicate exercise IDs",
      ),
  })
  .strict();
export type ExerciseReference = z.infer<typeof entry>;
export type TextSource = {
  repository: typeof referenceRepository;
  revision: typeof referenceRevision;
  exercise_id: string;
  license: "MIT";
};
export function referenceSource(row: ExerciseReference): TextSource {
  return {
    repository: referenceRepository,
    revision: referenceRevision,
    exercise_id: row.id,
    license: "MIT",
  };
}
const equipmentNames: Record<string, string> = {
  "body weight": "bodyweight",
  "ez barbell": "ez_bar",
  "leverage machine": "machine",
  "smith machine": "smith_machine",
  "stability ball": "stability_ball",
  "medicine ball": "medicine_ball",
  "bosu ball": "bosu_ball",
};
export function referenceEquipment(value: string) {
  return equipmentNames[value] ?? value.replace(/\s+/g, "_");
}
export function searchReferences(rows: ExerciseReference[], query: string) {
  const q = normalizeExercise(query);
  return rows
    .filter(
      (r) => !q || [r.name, r.equipment, r.target].some((s) => normalizeExercise(s).includes(q)),
    )
    .sort(
      (a, b) =>
        Number(normalizeExercise(b.name) === q) - Number(normalizeExercise(a.name) === q) ||
        a.name.localeCompare(b.name),
    );
}
export function sourceFromGuidance(guidance: ExerciseGuidance["guidance"]): TextSource | null {
  const value = guidance?.text_source;
  return value?.repository === referenceRepository &&
    value.revision === referenceRevision &&
    value.license === "MIT" &&
    /^\d{4}$/.test(value.exercise_id)
    ? value
    : null;
}
export const referenceSourceUrl = `https://github.com/${referenceRepository}/tree/${referenceRevision}`;
