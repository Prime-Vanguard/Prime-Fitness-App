import { normalizeExercise, type ExerciseGuidance } from "@/lib/exercise-guidance";
import { sourceFromGuidance } from "@/lib/exercise-reference";

// Stable provenance IDs reviewed against the bundled reference catalogue.
const referenceIds = new Set([
  "0025",
  "0031",
  "0085",
  "0198",
  "0201",
  "0200",
  "0861",
  "0289",
  "0313",
  "0334",
]);
export function muscleSuggestionReason(exercise: ExerciseGuidance, preferred: string[]) {
  if (preferred.includes(exercise.id)) return "context";
  const source = sourceFromGuidance(exercise.guidance);
  return source && referenceIds.has(source.exercise_id) ? "catalogue" : "basic";
}

// Editorial starting points, not popularity statistics or a substitute for coach programming.
const startingPoints = new Set(
  [
    "barbell bench press",
    "bench press",
    "push up",
    "push-up",
    "dumbbell bench press",
    "lat pulldown",
    "pull-up",
    "pull up",
    "seated cable row",
    "barbell row",
    "overhead press",
    "dumbbell shoulder press",
    "lateral raise",
    "dumbbell lateral raise",
    "barbell curl",
    "dumbbell curl",
    "hammer curl",
    "triceps pushdown",
    "cable pushdown",
    "lying triceps extension",
    "plank",
    "crunch",
    "dead bug",
    "barbell squat",
    "squat",
    "goblet squat",
    "leg press",
    "romanian deadlift",
    "lying leg curl",
    "seated leg curl",
    "hip thrust",
    "glute bridge",
    "standing calf raise",
    "seated calf raise",
  ].map(normalizeExercise),
);

/** Pass already-filtered results so suggestions never bypass equipment/mode or archive rules. */
export function muscleStartingPoints(
  results: ExerciseGuidance[],
  preferred: string[],
  muscle: string,
  query: string,
) {
  if (!muscle || query.trim()) return [];
  return results
    .filter(
      (exercise) =>
        exercise.active !== false &&
        exercise.muscle === muscle &&
        exercise.guidance?.catalogue_kind !== "cardio",
    )
    .filter(
      (exercise) =>
        preferred.includes(exercise.id) ||
        referenceIds.has(sourceFromGuidance(exercise.guidance)?.exercise_id ?? "") ||
        [exercise.name_en, ...(exercise.aliases ?? [])].some((name) =>
          startingPoints.has(normalizeExercise(name)),
        ),
    )
    .sort(
      (a, b) =>
        Number(preferred.includes(b.id)) - Number(preferred.includes(a.id)) ||
        a.name_en.localeCompare(b.name_en),
    )
    .slice(0, 4);
}
