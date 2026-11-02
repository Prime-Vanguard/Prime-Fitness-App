import type { Exercise } from "./training-tools";
export type ExerciseGuidance = Exercise & {
  active?: boolean;
  instructions?: string | null;
  media_url?: string | null;
  aliases?: string[];
  equipment_tags?: string[];
  movement_pattern?: string | null;
  logging_mode?: "weighted_reps" | "bodyweight_reps" | "timed";
  load_convention?: "external_total" | "per_hand" | "bodyweight";
  guidance?: {
    steps_en?: string;
    steps_ar?: string;
    cues_en?: string;
    cues_ar?: string;
    mistakes_en?: string;
    mistakes_ar?: string;
    text_source?: import("./exercise-reference").TextSource;
  };
  media?: {
    url: string;
    author: string;
    source: string;
    license: string;
    permission: string;
    attribution: string;
    poster?: string;
    kind?: "gif" | "image" | "video";
  } | null;
  editorial_status?: string;
};
export const normalizeExercise = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .trim();
/** Frozen identity/measurement metadata wins; current reviewed guidance/media stays current. */
export function exerciseWithSnapshot(
  id: string,
  snapshot: unknown,
  catalogue?: ExerciseGuidance,
): ExerciseGuidance {
  const raw =
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? (snapshot as Record<string, unknown>)
      : {};
  const mode = raw["logging_mode"],
    convention = raw["load_convention"];
  return {
    ...catalogue,
    id,
    name_en: historicalExerciseLabel(snapshot, catalogue, "en"),
    name_ar: historicalExerciseLabel(snapshot, catalogue, "ar"),
    muscle: typeof raw["muscle"] === "string" ? raw["muscle"] : (catalogue?.muscle ?? "other"),
    equipment:
      typeof raw["equipment"] === "string" || raw["equipment"] === null
        ? raw["equipment"]
        : (catalogue?.equipment ?? null),
    ...(mode === "weighted_reps" || mode === "bodyweight_reps" || mode === "timed"
      ? { logging_mode: mode }
      : {}),
    ...(convention === "external_total" || convention === "per_hand" || convention === "bodyweight"
      ? { load_convention: convention }
      : {}),
  };
}
export function historicalExerciseLabel(
  snapshot: unknown,
  fallback: { name_en?: string | null; name_ar?: string | null } | null | undefined,
  locale: "en" | "ar",
) {
  const names =
    snapshot && typeof snapshot === "object" ? (snapshot as Record<string, unknown>) : {};
  return (
    (locale === "ar" && typeof names["name_ar"] === "string" && names["name_ar"].trim()) ||
    (typeof names["name_en"] === "string" && names["name_en"].trim()) ||
    (locale === "ar" && fallback?.name_ar) ||
    fallback?.name_en ||
    (locale === "ar" ? "تمرين سابق" : "Historical exercise")
  );
}
export function discoverExercises(
  exercises: ExerciseGuidance[],
  query: string,
  filters: { equipment?: string; muscle?: string; mode?: string; preferred?: string[] } = {},
) {
  const q = normalizeExercise(query);
  return exercises
    .filter(
      (e) =>
        e.active !== false &&
        (!filters.equipment || (e.equipment_tags ?? [e.equipment]).includes(filters.equipment)) &&
        (!filters.muscle || e.muscle === filters.muscle) &&
        (!filters.mode || (e.logging_mode ?? "weighted_reps") === filters.mode),
    )
    .map((e) => {
      const names = [e.name_en, e.name_ar ?? ""].map(normalizeExercise),
        aliases = (e.aliases ?? []).map(normalizeExercise);
      const rank = !q
        ? 10
        : names.includes(q)
          ? 0
          : aliases.includes(q)
            ? 1
            : names.some((n) => n.startsWith(q))
              ? 2
              : [...names, ...aliases].some((n) => n.includes(q))
                ? 3
                : 100;
      return { e, rank: rank - (filters.preferred?.includes(e.id) ? 0.1 : 0) };
    })
    .filter((x) => x.rank < 99)
    .sort((a, b) => a.rank - b.rank || a.e.name_en.localeCompare(b.e.name_en))
    .map((x) => x.e);
}
