export type Units = "metric" | "imperial";
const LB_PER_KG = 2.20462262185;
// Convert at the display boundary; stored measurements use kilograms and centimetres.
export const weightUnit = (units: Units) => (units === "imperial" ? "lb" : "kg");
export const lengthUnit = (units: Units) => (units === "imperial" ? "in" : "cm");
export const storedWeight = (value: number, units: Units) =>
  Math.round((units === "imperial" ? value / LB_PER_KG : value) * 100) / 100;
// Show the shortest pound value that saves back to the same kilograms, so 135 lb does not
// read 134.99 and an untouched kilogram value is not changed by re-saving it in pounds.
export function displayWeight(kg: number, units: Units) {
  if (units !== "imperial") return kg;
  const lb = kg * LB_PER_KG;
  for (const step of [1, 10, 100]) {
    const candidate = Math.round(lb * step) / step;
    if (storedWeight(candidate, units) === kg) return candidate;
  }
  return lb;
}
export const displayLength = (cm: number, units: Units) => (units === "imperial" ? cm / 2.54 : cm);
export const storedLength = (value: number, units: Units) =>
  Math.round((units === "imperial" ? value * 2.54 : value) * 100) / 100;
export const formatMeasure = (value: number) => Math.round(value * 100) / 100;
