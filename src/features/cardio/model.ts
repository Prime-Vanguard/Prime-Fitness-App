import { z } from "zod";
import { validActivityDate } from "@/lib/training-search";
export const activities = [
  "walk",
  "run",
  "cycle",
  "row",
  "elliptical",
  "stairs",
  "other",
  "hiit",
] as const;
export const intervalPlan = z
  .object({
    work: z.number().int().min(1).max(3600),
    rest: z.number().int().min(0).max(3600),
    rounds: z.number().int().min(1).max(100),
    prepare: z.number().int().min(0).max(600),
  })
  .strict()
  .refine((p) => intervalTotal(p) <= 86400, "HIIT is limited to 24 hours");
export type IntervalPlan = { work: number; rest: number; rounds: number; prepare: number };
export function intervalTotal(p: IntervalPlan) {
  return p.prepare + p.work * p.rounds + p.rest * (p.rounds - 1);
}
export function intervalPosition(p: IntervalPlan, elapsed: number) {
  const time = Math.max(0, Math.floor(elapsed));
  if (time >= intervalTotal(p)) return { phase: "done" as const, round: p.rounds, remaining: 0 };
  if (time < p.prepare) return { phase: "prepare" as const, round: 1, remaining: p.prepare - time };
  const current = time - p.prepare,
    round = Math.floor(current / (p.work + p.rest)) + 1,
    offset = current % (p.work + p.rest);
  return offset < p.work
    ? { phase: "work" as const, round, remaining: p.work - offset }
    : { phase: "rest" as const, round, remaining: p.work + p.rest - offset };
}
export const cardioData = z
  .object({
    activity: z.enum(activities),
    log_date: z.string().refine(validActivityDate),
    duration_seconds: z.number().int().min(1).max(86400),
    distance_m: z.number().finite().min(0).max(1000000).nullable().default(null),
    incline_pct: z.number().finite().min(-20).max(40).nullable().default(null),
    resistance: z.string().max(80).nullable().default(null),
    heart_rate: z.number().int().min(30).max(240).nullable().default(null),
    notes: z.string().max(2000).default(""),
    intervals: intervalPlan.nullable().default(null),
  })
  .refine(
    (v) =>
      v.activity !== "hiit" || (!!v.intervals && v.duration_seconds === intervalTotal(v.intervals)),
    "HIIT duration must match its interval plan",
  );
export type CardioData = z.output<typeof cardioData>;
export const cardioRecord = cardioData.safeExtend({
  id: z.string().uuid(),
  member_id: z.string().uuid(),
  revision: z.number().int().min(0),
  deleted_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type CardioRecord = z.output<typeof cardioRecord>;
export const intervalTimer = z.object({
  id: z.string().uuid(),
  plan: intervalPlan,
  log_date: z.string().refine(validActivityDate),
  elapsed: z.number().finite().min(0),
  anchor: z.number().finite().nullable(),
  saved: z.boolean().default(false),
});
export type IntervalTimer = z.output<typeof intervalTimer>;
export function timerElapsed(timer: IntervalTimer, now = Date.now()) {
  return Math.min(
    intervalTotal(timer.plan),
    timer.elapsed + (timer.anchor == null ? 0 : Math.max(0, now - timer.anchor) / 1000),
  );
}
export function cardioPace(duration: number, metres: number | null, unit: "metric" | "imperial") {
  if (!metres || metres <= 0 || duration <= 0) return null;
  const distance = metres / (unit === "imperial" ? 1609.344 : 1000),
    pace = Math.round(duration / distance);
  return {
    speed: distance / (duration / 3600),
    pace: `${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, "0")}`,
  };
}
