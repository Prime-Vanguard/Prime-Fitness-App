export type Units = "metric" | "imperial";
const LB_PER_KG = 2.20462262185;
export const weightUnit = (units: Units) => (units === "imperial" ? "lb" : "kg");
export const lengthUnit = (units: Units) => (units === "imperial" ? "in" : "cm");
export const displayWeight = (kg: number, units: Units) =>
  units === "imperial" ? kg * LB_PER_KG : kg;
export const storedWeight = (value: number, units: Units) =>
  Math.round((units === "imperial" ? value / LB_PER_KG : value) * 100) / 100;
export const displayLength = (cm: number, units: Units) => (units === "imperial" ? cm / 2.54 : cm);
export const storedLength = (value: number, units: Units) =>
  Math.round((units === "imperial" ? value * 2.54 : value) * 100) / 100;
export const formatMeasure = (value: number) => Math.round(value * 100) / 100;
