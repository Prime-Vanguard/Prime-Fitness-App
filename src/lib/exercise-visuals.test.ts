import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { catalogueVisual, indexVisualCatalogue, visualCatalogueSchema } from "./exercise-visuals";
import { referenceRepository, referenceRevision } from "./exercise-reference";
const data = visualCatalogueSchema.parse(
  JSON.parse(readFileSync("public/data/exercise-visuals.json", "utf8")),
);
const index = indexVisualCatalogue(data);
const exercise = {
  id: "bench",
  name_en: "Bench Press",
  name_ar: null,
  muscle: "chest",
  equipment: "barbell",
};
it("accounts for every pinned catalogue reference and retains proprietary attribution", () => {
  expect(data.exercises).toHaveLength(1324);
  expect(index.byId.size).toBe(data.exercises.length);
  const visual = catalogueVisual(exercise, index)!;
  expect(visual.poster).toContain("/images/0025-");
  expect(visual.url).toContain("/videos/0025-");
  expect(visual.license).not.toBe("MIT");
  expect(visual.attribution).toContain("Gym Visual");
});
it("does not guess ambiguous variants or mismatched equipment", () => {
  expect(
    catalogueVisual({ ...exercise, name_en: "barbell bench press", equipment: "dumbbell" }, index),
  ).toBeNull();
  expect(catalogueVisual({ ...exercise, name_en: "Bench" }, index)).toBeNull();
  const duplicate = indexVisualCatalogue({
    ...data,
    exercises: [
      data.exercises.find((r) => r.id === "0025")!,
      { ...data.exercises.find((r) => r.id === "0025")!, id: "9999" },
    ],
  });
  expect(catalogueVisual(exercise, duplicate)).toBeNull();
});
it("uses a confirmed source ID when frozen display names differ", () => {
  const visual = catalogueVisual(
    {
      ...exercise,
      name_en: "Frozen old name",
      guidance: {
        text_source: {
          repository: referenceRepository,
          revision: referenceRevision,
          exercise_id: "0025",
          license: "MIT",
        },
      },
    },
    index,
  );
  expect(visual?.poster).toContain("/images/0025-");
});
it("maps starter-catalogue equivalents without substituting different movement variants", () => {
  expect(catalogueVisual({ ...exercise, name_en: "Barbell Row" }, index)?.url).toContain(
    "/videos/0027-",
  );
  expect(
    catalogueVisual(
      { ...exercise, name_en: "Incline Dumbbell Press", equipment: "dumbbell" },
      index,
    )?.url,
  ).toContain("/videos/0314-");
  expect(
    catalogueVisual({ ...exercise, name_en: "Plank", equipment: "bodyweight" }, index),
  ).toBeNull();
  expect(
    catalogueVisual({ ...exercise, name_en: "Walking Lunge", equipment: "dumbbell" }, index),
  ).toBeNull();
});
