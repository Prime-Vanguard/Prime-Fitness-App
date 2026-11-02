import { z } from "zod";
import { normalizeExercise, type ExerciseGuidance } from "./exercise-guidance";
import {
  referenceRepository,
  referenceRevision,
  sourceFromGuidance,
  referenceEquipment,
} from "./exercise-reference";
import type { ExerciseMedia } from "./exercise-media";

export const visualCatalogueSchema = z
  .object({
    revision: z.literal(referenceRevision),
    exercises: z
      .array(
        z
          .object({
            id: z.string().regex(/^\d{4}$/),
            name: z.string(),
            equipment: z.string(),
            image: z.string().regex(/^images\/[\w-]+\.(jpg|jpeg|png)$/),
            gif: z.string().regex(/^videos\/[\w-]+\.gif$/),
          })
          .strict(),
      )
      .max(5000),
  })
  .strict();
type Visual = z.infer<typeof visualCatalogueSchema>["exercises"][number];
// Explicit equivalents for the application's original starter catalogue.
const starterMappings: Record<string, string> = {
  "barbell back squat|barbell": "0043",
  "incline dumbbell press|dumbbell": "0314",
  "barbell row|barbell": "0027",
  "lat pulldown|cable": "0198",
  "dumbbell curl|dumbbell": "0294",
};
export function indexVisualCatalogue(data: z.infer<typeof visualCatalogueSchema>) {
  const byId = new Map(data.exercises.map((row) => [row.id, row]));
  const byName = new Map<string, Visual[]>();
  for (const row of data.exercises) {
    const name = normalizeExercise(row.name);
    byName.set(name, [...(byName.get(name) ?? []), row]);
  }
  return { byId, byName };
}
export function catalogueVisual(
  exercise: ExerciseGuidance,
  index: ReturnType<typeof indexVisualCatalogue>,
): ExerciseMedia | null {
  const source = sourceFromGuidance(exercise.guidance);
  const equipment = referenceEquipment(normalizeExercise(exercise.equipment ?? ""));
  let match = source ? index.byId.get(source.exercise_id) : undefined;
  const mapped = starterMappings[`${normalizeExercise(exercise.name_en)}|${equipment}`];
  if (!match && mapped) match = index.byId.get(mapped);
  if (!match && equipment) {
    // Exact identity or equipment-prefixed identity only. No fuzzy/anatomical guesses.
    const name = normalizeExercise(exercise.name_en);
    const candidates = [
      ...(index.byName.get(name) ?? []),
      ...(index.byName.get(`${equipment} ${name}`) ?? []),
    ].filter((row) => referenceEquipment(row.equipment) === equipment);
    const unique = [...new Map(candidates.map((row) => [row.id, row])).values()];
    if (unique.length === 1) match = unique[0];
  }
  if (!match) return null;
  const base = `https://raw.githubusercontent.com/${referenceRepository}/${referenceRevision}/`;
  return {
    url: `${base}${match.gif}`,
    poster: `${base}${match.image}`,
    kind: "gif",
    author: "Gym Visual",
    source: `https://github.com/${referenceRepository}/tree/${referenceRevision}`,
    license: "Gym Visual commercial catalogue",
    permission: "Catalogue use authorized by the application owner, who confirmed licensing.",
    attribution: "© Gym Visual · gymvisual.com",
  };
}
