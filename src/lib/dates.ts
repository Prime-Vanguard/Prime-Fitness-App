export const TRAINING_ZONE = "Africa/Cairo";
// Activity dates follow Cairo even when the device is in another time zone.
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
// Calendar-date arithmetic uses UTC noon rather than the device's local midnight.
export function addDays(day: string, count: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid activity date.");
  const date = new Date(`${day}T12:00:00Z`);
  if (date.toISOString().slice(0, 10) !== day) throw new Error("Invalid activity date.");
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
// "Today, 23 Nov" / "اليوم، 23 نوفمبر": friendly Cairo date for a day key or timestamp.
export function friendlyDay(value: string, locale: "ar" | "en", today = activityDay()): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : activityDay(value);
  const label = new Date(`${day}T12:00:00Z`).toLocaleDateString(
    locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
    { timeZone: "UTC", day: "numeric", month: "short" },
  );
  const near =
    day === today ? ["Today", "اليوم"] : day === addDays(today, -1) ? ["Yesterday", "أمس"] : null;
  return near ? `${near[locale === "ar" ? 1 : 0]}${locale === "ar" ? "، " : ", "}${label}` : label;
}
