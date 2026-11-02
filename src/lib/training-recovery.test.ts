import { expect, it } from "vitest";
import { overlayPendingRecords } from "./member-records";
import { historicalExerciseLabel } from "./exercise-guidance";
it("keeps older online history and overlays pending changes and deletions", () => {
  const remote = [
    { id: "old", weight: 80 },
    { id: "edited", weight: 81 },
    { id: "deleted", weight: 82 },
  ];
  expect(
    overlayPendingRecords(
      remote,
      [
        { id: "edited", weight: 79 },
        { id: "new", weight: 78 },
      ],
      [{ record_id: "edited" }, { record_id: "deleted" }, { record_id: "new" }],
    ),
  ).toEqual([
    { id: "old", weight: 80 },
    { id: "edited", weight: 79 },
    { id: "new", weight: 78 },
  ]);
});
it("uses immutable exercise labels before renamed catalogue labels in both languages", () => {
  const snapshot = { name_en: "Original squat", name_ar: "السكوات الأصلي" },
    current = { name_en: "Renamed", name_ar: "اسم جديد" };
  expect(historicalExerciseLabel(snapshot, current, "en")).toBe("Original squat");
  expect(historicalExerciseLabel(snapshot, current, "ar")).toBe(snapshot.name_ar);
  expect(historicalExerciseLabel(null, current, "en")).toBe("Renamed");
  expect(historicalExerciseLabel(null, null, "ar")).toBe("تمرين سابق");
});
