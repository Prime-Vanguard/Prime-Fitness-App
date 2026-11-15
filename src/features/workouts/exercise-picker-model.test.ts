import { describe, expect, it } from "vitest";
import type { ExerciseGuidance } from "@/lib/exercise-guidance";
import { pickerResults } from "./exercise-picker-model";
const row = (
  id: string,
  name_en: string,
  extra: Partial<ExerciseGuidance> = {},
): ExerciseGuidance => ({
  id,
  name_en,
  name_ar: "ضغط الصدر",
  muscle: "chest",
  equipment: "barbell",
  ...extra,
});
const options = {
  view: "suggested" as const,
  query: "",
  muscle: "",
  equipment: "",
  mode: "",
  program: [] as string[],
  recent: [] as string[],
  favorites: [] as string[],
};
describe("focused exercise discovery", () => {
  it("opens at most eight relevant choices without filling with arbitrary catalogue variants", () => {
    const rows = Array.from({ length: 30 }, (_, i) => row(String(i), `Variant ${i}`));
    expect(pickerResults(rows, options)).toEqual([]);
    expect(pickerResults(rows, { ...options, program: rows.map((e) => e.id) })).toHaveLength(8);
    expect(pickerResults([row("basic", "Bench Press"), ...rows], options).map((e) => e.id)).toEqual(
      ["basic"],
    );
  });
  it("orders program then actual recent/favorites and removes duplicates", () => {
    const rows = [row("a", "Bench Press"), row("b", "Row"), row("c", "Coach choice")];
    expect(
      pickerResults(rows, { ...options, program: ["c"], recent: ["b", "c"], favorites: ["a"] }).map(
        (e) => e.id,
      ),
    ).toEqual(["c", "b", "a"]);
    expect(
      pickerResults(rows, { ...options, view: "recent", recent: ["b", "a", "b"] }).map((e) => e.id),
    ).toEqual(["b", "a"]);
  });
  it("searches all catalogue names and Arabic aliases even from an empty favorites view", () => {
    const rows = [
      row("exact", "Bench Press"),
      row("variant", "Bench Press Wide"),
      row("alias", "Press", { aliases: ["تمرين صدري"] }),
    ];
    expect(
      pickerResults(rows, {
        ...options,
        view: "favorites",
        query: "bench press",
        favorites: ["variant"],
      }).map((e) => e.id),
    ).toEqual(["exact", "variant"]);
    expect(pickerResults(rows, { ...options, query: "تمرين صدري" }).map((e) => e.id)).toEqual([
      "alias",
    ]);
  });
  it("combines filters and excludes archived/cardio entries from every shortcut and search", () => {
    const rows = [
      row("ok", "Bench Press"),
      row("archived", "Bench Press", { active: false }),
      row("cardio", "Bench Press", { guidance: { catalogue_kind: "cardio" } }),
      row("dumbbell", "Bench Press", { equipment: "dumbbell" }),
    ];
    for (const view of ["suggested", "recent", "favorites", "all"] as const) {
      expect(
        pickerResults(rows, {
          ...options,
          view,
          recent: rows.map((e) => e.id),
          favorites: rows.map((e) => e.id),
          equipment: "barbell",
          muscle: "chest",
        }).map((e) => e.id),
      ).toEqual(["ok"]);
    }
    expect(
      pickerResults(rows, { ...options, view: "all", query: "bench", muscle: "back" }),
    ).toEqual([]);
  });
});
