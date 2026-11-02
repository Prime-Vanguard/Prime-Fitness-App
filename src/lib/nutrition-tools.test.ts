import { describe, expect, it } from "vitest";
import { mealCalories, mealItem, parseMealItems, scaleMealItem } from "./nutrition-tools";
import { muscleVolume } from "./muscle-volume";
describe("meal and volume helpers", () => {
  it("scales portions from unchanged base macros including Arabic fractions", () => {
    const base = { name: "Oats", calories: 200, protein_g: 10, carbs_g: 30, fat_g: 5 };
    expect(scaleMealItem(base, "١٫٥")).toEqual({
      ...base,
      calories: 300,
      protein_g: 15,
      carbs_g: 45,
      fat_g: 7.5,
    });
    expect(scaleMealItem(base, 2).calories).toBe(400);
    expect(scaleMealItem(base, 1)).toEqual(base);
  });
  it("rejects missing, negative, nonfinite, oversized and effectively empty portions", () => {
    const base = { name: "Food", calories: 200, protein_g: 0, carbs_g: 0, fat_g: 0 };
    for (const factor of ["", 0, -1, "NaN", 101, 100])
      expect(() => scaleMealItem(base, factor)).toThrow();
    expect(() => scaleMealItem({ ...base, calories: 1 }, 0.01)).toThrow("too small");
  });
  it("allows quick macros without a library food or food name", () => {
    expect(
      mealItem({ name: "", calories: "500", protein_g: "40", carbs_g: "", fat_g: "" }),
    ).toMatchObject({ name: "Quick add", calories: 500, protein_g: 40 });
  });
  it("rejects negative, nonnumeric, and empty macro entries", () => {
    for (const calories of [-1, NaN, 10001, 0])
      expect(() =>
        mealItem({ name: "food", calories, protein_g: 0, carbs_g: 0, fat_g: 0 }),
      ).toThrow();
  });
  it("restores ingredient-level templates without losing macros", () => {
    const items = [
      mealItem({ name: "Whey", calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1 }),
      mealItem({ name: "Oats", calories: 200, protein_g: 6, carbs_g: 35, fat_g: 4 }),
    ];
    expect(mealCalories(parseMealItems(JSON.parse(JSON.stringify(items))))).toBe(320);
    expect(() => parseMealItems([{ name: "bad", calories: "12" }])).toThrow();
  });
  it("attributes volume once to the primary muscle and reports unmapped sets", () => {
    const result = muscleVolume(
      [
        { exercise_id: "squat", reps: 5, weight_kg: 100 },
        { exercise_id: "unknown", reps: 5, weight_kg: 20 },
      ],
      [{ id: "squat", muscle: "legs" }],
    );
    expect(result.groups.quads).toEqual({ sets: 1, kg: 500, seconds: 0 });
    expect(result.groups.back.sets).toBe(0);
    expect(result.unmapped).toBe(1);
  });
});
