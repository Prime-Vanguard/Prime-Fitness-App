export type RestPreferences = { volume: number; muted: boolean; vibration: boolean };
export const restDefaults: RestPreferences = { volume: 0.7, muted: false, vibration: false };
export function readRestPreferences(): RestPreferences {
  try {
    const value = JSON.parse(localStorage.getItem("pf-rest-alert") ?? "null");
    return value &&
      typeof value.volume === "number" &&
      Number.isFinite(value.volume) &&
      value.volume >= 0 &&
      value.volume <= 1 &&
      typeof value.muted === "boolean" &&
      typeof value.vibration === "boolean"
      ? value
      : { ...restDefaults };
  } catch {
    return { ...restDefaults };
  }
}
export function saveRestPreferences(value: RestPreferences) {
  if (!Number.isFinite(value.volume) || value.volume < 0 || value.volume > 1)
    throw new Error("Invalid alert volume");
  localStorage.setItem("pf-rest-alert", JSON.stringify(value));
}
