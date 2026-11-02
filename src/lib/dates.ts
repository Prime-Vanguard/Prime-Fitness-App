export const TRAINING_ZONE = "Africa/Cairo";
export function activityDay(value: string | number | Date = Date.now()): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid activity timestamp.");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TRAINING_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function addDays(day: string, count: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid activity date.");
  const date = new Date(`${day}T12:00:00Z`);
  if (date.toISOString().slice(0, 10) !== day) throw new Error("Invalid activity date.");
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
