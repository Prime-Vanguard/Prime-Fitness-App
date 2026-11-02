import { storedLength, storedWeight, type Units } from "./units";
type Range = {
  label: string;
  min?: number;
  max?: number;
  integer?: boolean;
  exclusiveMin?: boolean;
};
export function inputNumber(
  value: string | number | null | undefined,
  { label, min = 0, max = Infinity, integer = false, exclusiveMin = false }: Range,
): number | null {
  if (value == null || (typeof value === "string" && !value.trim())) return null;
  let number: number;
  if (typeof value === "string") {
    let text = value
      .trim()
      .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
      .replaceAll("٫", ".");
    if (text.includes("٬")) {
      if (!/^[+-]?\d{1,3}(?:٬\d{3})+(?:\.\d+)?$/.test(text))
        throw new Error(`${label}: check the number format.`);
      text = text.replaceAll("٬", "");
    }
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))
      throw new Error(`${label}: enter a valid number.`);
    number = Number(text);
  } else number = value;
  if (
    !Number.isFinite(number) ||
    (integer && !Number.isSafeInteger(number)) ||
    (exclusiveMin ? number <= min : number < min) ||
    number > max
  )
    throw new Error(
      `${label}: enter ${integer ? "a whole" : "a finite"} number ${exclusiveMin ? "greater than" : "at least"} ${min}${Number.isFinite(max) ? ` and at most ${max}` : ""}.`,
    );
  return number;
}
export type BodyValues = {
  weight_kg: number | null;
  waist_cm: number | null;
  body_fat_pct: number | null;
};
export function validateBodyValues(values: BodyValues, allowEmpty = false): BodyValues {
  inputNumber(values.weight_kg, { label: "Weight", exclusiveMin: true });
  inputNumber(values.waist_cm, { label: "Waist", exclusiveMin: true });
  inputNumber(values.body_fat_pct, { label: "Body fat", max: 100 });
  if (!allowEmpty && Object.values(values).every((value) => value == null))
    throw new Error("Enter at least one measurement.");
  return values;
}
export function bodyInput(
  input: { weight_kg: string; waist_cm: string; body_fat_pct: string },
  units: Units,
): BodyValues {
  const weight = inputNumber(input.weight_kg, { label: "Weight", exclusiveMin: true });
  const waist = inputNumber(input.waist_cm, { label: "Waist", exclusiveMin: true });
  return validateBodyValues({
    weight_kg: weight == null ? null : storedWeight(weight, units),
    waist_cm: waist == null ? null : storedLength(waist, units),
    body_fat_pct: inputNumber(input.body_fat_pct, { label: "Body fat", max: 100 }),
  });
}
export function targetInput(
  input: Record<"calories" | "protein_g" | "carbs_g" | "fat_g" | "water_ml", string>,
) {
  return {
    calories: inputNumber(input.calories, { label: "Calories", max: 100000, integer: true }),
    protein_g: inputNumber(input.protein_g, { label: "Protein", max: 10000, integer: true }),
    carbs_g: inputNumber(input.carbs_g, { label: "Carbs", max: 10000, integer: true }),
    fat_g: inputNumber(input.fat_g, { label: "Fat", max: 10000, integer: true }),
    water_ml: inputNumber(input.water_ml, {
      label: "Water",
      max: 100000,
      exclusiveMin: true,
      integer: true,
    }),
  };
}
