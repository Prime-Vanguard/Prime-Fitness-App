import { expect, it } from "vitest";
import { pendingNutritionRows } from "./nutrition-tools";
it("retains old unsynced additions/edits over an older server snapshot without duplicating entries", () => {
  const result = pendingNutritionRows(
    [
      { id: "old", calories: 100 },
      { id: "remote", calories: 200 },
    ],
    [
      { id: "old", calories: 150 },
      { id: "new", calories: 300 },
    ],
    new Set(["old", "new"]),
  );
  expect(result).toEqual([
    { id: "remote", calories: 200 },
    { id: "old", calories: 150 },
    { id: "new", calories: 300 },
  ]);
});
it("does not resurrect a pending deletion and does not overlay unrelated cached rows", () => {
  expect(
    pendingNutritionRows([{ id: "deleted" }], [{ id: "unrelated" }], new Set(["deleted"])),
  ).toEqual([]);
});
