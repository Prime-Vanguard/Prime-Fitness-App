import { inputNumber } from "./numeric-input";
/** Overlay canonical pending rows; a pending deletion is absent from local rows. */
export function pendingNutritionRows<T extends { id: string }>(
  server: T[],
  local: T[],
  pending: Set<string>,
): T[] {
  return [
    ...server.filter((row) => !pending.has(row.id)),
    ...local.filter((row) => pending.has(row.id)),
  ];
}
export type MealItem = {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};
export function mealItem(input: {
  name: string;
  calories: string | number;
  protein_g: string | number;
  carbs_g: string | number;
  fat_g: string | number;
}): MealItem {
  const item = {
    name: input.name.trim() || "Quick add",
    calories: inputNumber(input.calories, { label: "Calories", max: 10000 }) ?? 0,
    protein_g: inputNumber(input.protein_g, { label: "Protein", max: 10000 }) ?? 0,
    carbs_g: inputNumber(input.carbs_g, { label: "Carbs", max: 10000 }) ?? 0,
    fat_g: inputNumber(input.fat_g, { label: "Fat", max: 10000 }) ?? 0,
  };
  if (
    item.name.length > 150 ||
    [item.calories, item.protein_g, item.carbs_g, item.fat_g].some(
      (n) => !Number.isFinite(n) || n < 0 || n > 10000,
    ) ||
    ![item.calories, item.protein_g, item.carbs_g, item.fat_g].some((n) => n > 0)
  )
    throw new Error("Enter a positive calorie or macro value (maximum 10,000 each).");
  item.calories = Math.round(item.calories);
  return item;
}
export function parseMealItems(value: unknown): MealItem[] {
  if (!Array.isArray(value) || !value.length || value.length > 50)
    throw new Error("Invalid saved meal.");
  return value.map((item: unknown) => {
    if (!item || typeof item !== "object" || !("name" in item) || typeof item.name !== "string")
      throw new Error("Invalid saved meal.");
    const x = item as Record<string, unknown>;
    for (const key of ["calories", "protein_g", "carbs_g", "fat_g"])
      if (typeof x[key] !== "number") throw new Error("Invalid saved meal.");
    return mealItem(x as MealItem);
  });
}
/** Input macros describe one portion; stored macros always describe the consumed total. */
export function scaleMealItem(
  input: Parameters<typeof mealItem>[0],
  portions: string | number,
): MealItem {
  const multiplier = inputNumber(portions, { label: "Portion multiplier", min: 0.01, max: 100 });
  if (multiplier == null) throw new Error("Enter a portion multiplier.");
  const base = mealItem(input);
  const scaled = mealItem({
    ...base,
    calories: base.calories * multiplier,
    protein_g: Math.round(base.protein_g * multiplier * 100) / 100,
    carbs_g: Math.round(base.carbs_g * multiplier * 100) / 100,
    fat_g: Math.round(base.fat_g * multiplier * 100) / 100,
  });
  if (![scaled.calories, scaled.protein_g, scaled.carbs_g, scaled.fat_g].some((n) => n > 0))
    throw new Error("This portion is too small to record.");
  return scaled;
}
export const mealCalories = (items: MealItem[]) =>
  items.reduce((sum, item) => sum + item.calories, 0);
