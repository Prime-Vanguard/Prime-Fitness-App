import {
  discoverExercises,
  isCardioReference,
  type ExerciseGuidance,
} from "@/lib/exercise-guidance";
import { muscleStartingPoints } from "./muscle-discovery";

export type PickerView = "suggested" | "recent" | "favorites" | "all";
export const PICKER_PAGE_SIZE = 12;

/** Search always spans the catalogue; view shortcuts never hide a named match.
 * Explicit muscle/equipment/mode filters still apply and are displayed by the UI. */
export function pickerResults(
  exercises: ExerciseGuidance[],
  options: {
    view: PickerView;
    query: string;
    muscle: string;
    equipment: string;
    mode: string;
    program: readonly string[];
    recent: readonly string[];
    favorites: readonly string[];
  },
) {
  const { program, recent, favorites, view, query, muscle, equipment, mode } = options;
  const eligible = exercises.filter((e) => !isCardioReference(e));
  const ordered = discoverExercises(eligible, query, {
    muscle,
    equipment,
    mode,
    preferred: [...program, ...recent],
  });
  if (query.trim() || view === "all") return ordered;
  const byId = new Map(ordered.map((e) => [e.id, e]));
  const resolve = (ids: readonly string[]) =>
    [...new Set(ids)].flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  if (view === "recent") return resolve(recent);
  if (view === "favorites") return resolve(favorites);
  // Editorial basics fill a small shortlist; no invented usage/popularity ranking.
  const muscles = muscle ? [muscle] : [...new Set(ordered.map((e) => e.muscle))];
  const basics = muscles.flatMap((m) => muscleStartingPoints(ordered, [], m, "").map((e) => e.id));
  return resolve([...program, ...recent, ...favorites, ...basics]).slice(0, 8);
}
