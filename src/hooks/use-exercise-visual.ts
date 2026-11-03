import { useQuery } from "@tanstack/react-query";
import { appPath } from "@/lib/app-path";
import type { ExerciseGuidance } from "@/lib/exercise-guidance";
import {
  catalogueVisual,
  indexVisualCatalogue,
  visualCatalogueSchema,
} from "@/lib/exercise-visuals";

/** Public catalogue metadata only; does not persist or change exercise editorial review. */
export function useExerciseVisual(exercise: ExerciseGuidance | undefined, enabled = true) {
  const approved = exercise?.editorial_status === "reviewed" ? exercise.media : null;
  const { data } = useQuery({
    queryKey: ["licensed-exercise-visual-catalogue"],
    enabled: enabled && !!exercise && !approved,
    staleTime: Infinity,
    retry: 1,
    queryFn: async ({ signal }) => {
      const response = await fetch(appPath("data/exercise-visuals.json"), {
        credentials: "omit",
        signal,
      });
      if (!response.ok) throw new Error("Exercise visuals unavailable");
      return indexVisualCatalogue(visualCatalogueSchema.parse(await response.json()));
    },
  });
  return approved ?? (enabled && exercise && data ? catalogueVisual(exercise, data) : null);
}
