import { describe, expect, it } from "vitest";
import { muscleStartingPoints } from "./muscle-discovery";
import type { ExerciseGuidance } from "@/lib/exercise-guidance";
import { referenceRepository, referenceRevision } from "@/lib/exercise-reference";
const exercise = (
  id: string,
  name_en: string,
  extra: Partial<ExerciseGuidance> = {},
): ExerciseGuidance => ({
  id,
  name_en,
  name_ar: null,
  muscle: "chest",
  equipment: "barbell",
  ...extra,
});
describe("muscle discovery starting points", () => {
  it("recognizes exact aliases and stable catalogue provenance without fuzzy matching", () => {
    const rows = [
      exercise("alias", "Local name", { aliases: ["Bench Press"] }),
      exercise("catalogue", "Renamed press", {
        guidance: {
          text_source: {
            repository: referenceRepository,
            revision: referenceRevision,
            exercise_id: "0025",
            license: "MIT",
          },
        },
      }),
      exercise("fuzzy", "Bench press on unstable ball"),
    ];
    expect(muscleStartingPoints(rows, [], "chest", "").map((row) => row.id)).toEqual([
      "alias",
      "catalogue",
    ]);
  });
  it("prioritizes actual program/recent IDs without inventing popular exercises", () => {
    const rows = [
      exercise("base", "Bench Press"),
      exercise("plan", "Coach exercise"),
      exercise("other", "Novel exercise"),
    ];
    expect(muscleStartingPoints(rows, ["plan"], "chest", "").map((x) => x.id)).toEqual([
      "plan",
      "base",
    ]);
    expect(muscleStartingPoints(rows, [], "", "")).toEqual([]);
    expect(muscleStartingPoints(rows, [], "chest", "bench")).toEqual([]);
  });
  it("never includes archived, cardio, other-muscle or absent filtered results", () => {
    const rows = [
      exercise("archived", "Bench Press", { active: false }),
      exercise("cardio", "Bench Press", { guidance: { catalogue_kind: "cardio" } }),
      exercise("other", "Bench Press", { muscle: "back" }),
    ];
    expect(
      muscleStartingPoints(
        rows,
        rows.map((x) => x.id),
        "chest",
        "",
      ),
    ).toEqual([]);
    expect(muscleStartingPoints([], ["missing"], "chest", "")).toEqual([]);
  });
});
