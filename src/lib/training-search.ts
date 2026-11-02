import { addDays, activityDay } from "./dates";
export type TrainSearch = {
  section?: "workout" | "program" | "history" | undefined;
  q?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  page?: number | undefined;
  session?: string | undefined;
};
export function validActivityDate(value: unknown): value is string {
  if (typeof value !== "string" || value.startsWith("0000-")) return false;
  try {
    return addDays(value, 0) === value;
  } catch {
    return false;
  }
}
export function trainingSearch(raw: Record<string, unknown>): TrainSearch {
  const section = raw["section"],
    rawPage = raw["page"],
    page =
      typeof rawPage === "number" || (typeof rawPage === "string" && /^\d+$/.test(rawPage))
        ? Number(rawPage)
        : 0;
  return {
    section: section === "history" || section === "program" ? section : undefined,
    q: typeof raw["q"] === "string" ? raw["q"].trim().slice(0, 100) || undefined : undefined,
    from: validActivityDate(raw["from"]) ? raw["from"] : undefined,
    to: validActivityDate(raw["to"]) ? raw["to"] : undefined,
    page: Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page : undefined,
    session:
      typeof raw["session"] === "string" &&
      /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(raw["session"])
        ? raw["session"].toLowerCase()
        : undefined,
  };
}
export const literalTitlePattern = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;
/** First actual instant of a Cairo date, including a skipped/repeated DST midnight. */
export function cairoDayStart(day: string): string {
  if (!validActivityDate(day)) throw new Error("Invalid activity date");
  const midnight = Date.parse(`${day}T00:00:00Z`);
  let low = midnight - 18 * 3600000,
    high = midnight + 18 * 3600000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (activityDay(middle) < day) low = middle + 1;
    else high = middle;
  }
  return new Date(low).toISOString();
}
export function historyDateFilter(from?: string, to?: string): string | null {
  if (!from && !to) return null;
  const explicit: string[] = [],
    timestamp = ["activity_date.is.null"];
  if (from) {
    explicit.push(`activity_date.gte.${from}`);
    timestamp.push(`started_at.gte.${cairoDayStart(from)}`);
  }
  if (to) {
    explicit.push(`activity_date.lte.${to}`);
    timestamp.push(`started_at.lt.${cairoDayStart(addDays(to, 1))}`);
  }
  return `${explicit.length > 1 ? `and(${explicit.join(",")})` : explicit[0]},and(${timestamp.join(",")})`;
}
