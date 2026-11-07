import { inputNumber } from "@/lib/numeric-input";
export type ScannedFood = {
  name: string;
  serving: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
};
export const emptyScannedFood = (): ScannedFood => ({
  name: "",
  serving: "",
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
});
export function validBarcode(value: string) {
  const code = value.trim();
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code))
    throw new Error("Enter an EAN/UPC barcode with 8, 12, 13 or 14 digits.");
  let sum = 0;
  for (let i = code.length - 2, position = 0; i >= 0; i--, position++)
    sum += Number(code[i]) * (position % 2 === 0 ? 3 : 1);
  if ((10 - (sum % 10)) % 10 !== Number(code.at(-1)))
    throw new Error("Barcode check digit is invalid. Check the number.");
  return code;
}
export function parseNutritionLabel(raw: string): ScannedFood {
  const text = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replaceAll("٫", ".")
    .replace(/(\d),(\d)/g, "$1.$2");
  const lines = text.split(/\r?\n/);
  const read = (label: RegExp, unit = "(?:g|غ|جم)") => {
    const line = lines.find((line) => label.test(line) && !/saturated|المشبعة/i.test(line));
    if (!line) return "";
    let values = [...line.matchAll(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, "gi"))];
    if (values.length === 0 && /calories|السعرات/i.test(line) && !/kJ/i.test(line))
      values = [...line.matchAll(/(\d+(?:\.\d+)?)/g)];
    // Multiple columns require manual review; never guess a serving basis.
    return values.length === 1 ? values[0]![1]! : "";
  };
  return {
    ...emptyScannedFood(),
    calories: read(/calories|energy|طاقة|سعر|kcal/i, "(?:kcal|calories|سعرة|سعرات)"),
    protein_g: read(/protein|بروتين/i),
    carbs_g: read(/carbohydrate|carbs|كربوهيدرات/i),
    fat_g: read(/(?:^|\s)(?:total\s+)?fat\b|دهون/i),
  };
}
export function productNutrition(value: unknown): ScannedFood {
  const body = value as {
    status?: number;
    product?: {
      product_name?: string;
      product_name_ar?: string;
      nutriments?: Record<string, unknown>;
    };
  };
  if (body?.status !== 1 || !body.product)
    throw new Error("Product not found. Enter the label manually.");
  const nutrients = body.product.nutriments ?? {};
  const field = (key: string) =>
    typeof nutrients[key] === "number" &&
    Number.isFinite(nutrients[key]) &&
    Number(nutrients[key]) >= 0
      ? String(nutrients[key])
      : "";
  return {
    name: (body.product.product_name ?? body.product.product_name_ar ?? "").slice(0, 200),
    serving: "100 g / 100 ml — confirm label",
    calories: field("energy-kcal_100g"),
    protein_g: field("proteins_100g"),
    carbs_g: field("carbohydrates_100g"),
    fat_g: field("fat_100g"),
  };
}
export function reviewedNutrition(value: ScannedFood) {
  if (!value.name.trim() || !value.serving.trim())
    throw new Error("Enter a food name and confirm the serving basis.");
  const number = (key: "calories" | "protein_g" | "carbs_g" | "fat_g") => {
    const n = inputNumber(value[key], { label: key, max: key === "calories" ? 10000 : 1000 });
    if (n == null) throw new Error("Review every nutrient; missing values are not zero.");
    return n;
  };
  return {
    name: value.name.trim(),
    serving: value.serving.trim(),
    calories: number("calories"),
    protein_g: number("protein_g"),
    carbs_g: number("carbs_g"),
    fat_g: number("fat_g"),
  };
}
