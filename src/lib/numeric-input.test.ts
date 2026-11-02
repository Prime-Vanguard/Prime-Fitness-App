import { describe, expect, it } from "vitest";
import { bodyInput, inputNumber, targetInput } from "./numeric-input";
describe("numeric integrity", () => {
  it.each(["NaN", "Infinity", "-1", "12 cats", "0x10", "1e3", "1,5"])(
    "rejects invalid or ambiguous input %s",
    (value) => {
      expect(() => inputNumber(value, { label: "Test" })).toThrow();
    },
  );
  it("accepts Arabic/Persian digits and a validated Arabic thousands separator", () => {
    expect(inputNumber("١٬٢٣٤٫٥", { label: "Test" })).toBe(1234.5);
    expect(inputNumber("۷۵٫۲", { label: "Test" })).toBe(75.2);
    expect(() => inputNumber("١٢٬٥", { label: "Test" })).toThrow("format");
  });
  it("keeps blank fields null and does not clamp invalid targets to zero", () => {
    expect(inputNumber(" ", { label: "Test" })).toBeNull();
    const valid = { calories: "", protein_g: "0", carbs_g: "", fat_g: "", water_ml: "2500" };
    expect(targetInput(valid)).toEqual({
      calories: null,
      protein_g: 0,
      carbs_g: null,
      fat_g: null,
      water_ml: 2500,
    });
    for (const change of [{ calories: "-5" }, { protein_g: "2.5" }, { water_ml: "0" }])
      expect(() => targetInput({ ...valid, ...change })).toThrow();
  });
  it("validates percentages and preserves canonical imperial conversion", () => {
    expect(
      bodyInput({ weight_kg: "٢٢٠٫٤٦", waist_cm: "٣٩٫٣٧", body_fat_pct: "٢٠" }, "imperial"),
    ).toEqual({ weight_kg: 100, waist_cm: 100, body_fat_pct: 20 });
    expect(() =>
      bodyInput({ weight_kg: "80", waist_cm: "", body_fat_pct: "101" }, "metric"),
    ).toThrow("at most 100");
    expect(() =>
      bodyInput({ weight_kg: "-80", waist_cm: "", body_fat_pct: "" }, "metric"),
    ).toThrow();
    expect(() => bodyInput({ weight_kg: "", waist_cm: "", body_fat_pct: "" }, "metric")).toThrow(
      "at least one",
    );
  });
});
