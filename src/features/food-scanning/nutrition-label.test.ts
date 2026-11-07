import { expect, it } from "vitest";
import {
  emptyScannedFood,
  parseNutritionLabel,
  productNutrition,
  reviewedNutrition,
  validBarcode,
} from "./nutrition-label";
it("validates check digits without dropping leading zeros", () => {
  expect(validBarcode(" 012345678905 ")).toBe("012345678905");
  expect(() => validBarcode("012345678906")).toThrow("check digit");
  expect(() => validBarcode("123")).toThrow();
});
it("reads English and Arabic label values while leaving serving interpretation to the member", () => {
  expect(
    parseNutritionLabel(
      "Energy 120 kcal\nProtein 4.5 g\nCarbohydrates 15 g\nTotal fat 2 g\nSaturated fat 1 g",
    ),
  ).toMatchObject({ calories: "120", protein_g: "4.5", carbs_g: "15", fat_g: "2", serving: "" });
  expect(
    parseNutritionLabel("الطاقة ١٢٠ سعرة\nبروتين ٤٫٥ غ\nكربوهيدرات ١٥ غ\nدهون ٢ غ"),
  ).toMatchObject({ calories: "120", protein_g: "4.5", carbs_g: "15", fat_g: "2" });
});
it("does not guess columns or interpret missing nutrients as zero", () => {
  expect(parseNutritionLabel("Protein 3 g 6 g").protein_g).toBe("");
  const food = productNutrition({
    status: 1,
    product: { product_name: "Milk", nutriments: { fat_100g: 0 } },
  });
  expect(food.fat_g).toBe("0");
  expect(food.protein_g).toBe("");
  expect(() => reviewedNutrition(food)).toThrow("missing values");
  expect(() => productNutrition({ status: 0 })).toThrow("not found");
  expect(() => reviewedNutrition(emptyScannedFood())).toThrow();
  expect(
    reviewedNutrition({ ...food, calories: "١٠٠", protein_g: "4", carbs_g: "5" }),
  ).toMatchObject({ calories: 100, fat_g: 0 });
});
