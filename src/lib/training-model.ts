import { z } from "zod";
export const modeSchema = z.enum(["weighted_reps", "bodyweight_reps", "timed"]);
export const roleSchema = z.enum(["working", "warmup", "drop"]);
export const sideSchema = z.enum(["bilateral", "left", "right"]);
export const conventionSchema = z.enum(["external_total", "per_hand", "bodyweight"]);
export type LoggingMode = z.infer<typeof modeSchema>;
export const setDetailsSchema = z.object({
  logging_mode: modeSchema.default("weighted_reps"),
  set_role: roleSchema.default("working"),
  side: sideSchema.default("bilateral"),
  pair_id: z.string().uuid().nullable().default(null),
  duration_seconds: z.number().int().min(1).max(86400).nullable().default(null),
  root_set_id: z.string().uuid().nullable().default(null),
  segment_index: z.number().int().min(0).max(100).default(0),
  load_convention: conventionSchema.default("external_total"),
  slot_key: z.string().max(100).default(""),
});
export type SetDetails = z.infer<typeof setDetailsSchema>;
export type PerformanceSet = Partial<SetDetails> & {
  reps: number | null;
  weight_kg: number | null;
  rpe?: number | null;
  exercise_id?: string;
  id?: string;
  session_id?: string;
};
export function validateSetDetails(value: PerformanceSet) {
  const d = setDetailsSchema.parse(value);
  if (
    d.logging_mode === "timed"
      ? !d.duration_seconds || value.reps != null
      : value.reps == null || !Number.isInteger(value.reps) || value.reps < 1 || value.reps > 1000
  )
    throw new Error("Enter valid reps or duration for this exercise.");
  if (d.side !== "bilateral" && !d.pair_id)
    throw new Error("Unilateral sets need a left/right pair.");
  if (
    (d.side === "bilateral" && d.pair_id != null) ||
    (d.logging_mode !== "timed" && d.duration_seconds != null)
  )
    throw new Error("Set measurement and side details are inconsistent.");
  if (
    d.set_role === "drop"
      ? !d.root_set_id || d.segment_index < 1
      : d.root_set_id != null || d.segment_index !== 0
  )
    throw new Error("Link each drop segment to a working set.");
  if (
    value.weight_kg != null &&
    (!Number.isFinite(value.weight_kg) || value.weight_kg < 0 || value.weight_kg > 1000)
  )
    throw new Error("Weight must be 0–1000 kg.");
  if (value.rpe != null && (!Number.isFinite(value.rpe) || value.rpe < 1 || value.rpe > 10))
    throw new Error("RPE must be 1–10.");
  return d;
}
export function setMetrics(set: PerformanceSet) {
  const working = (set.set_role ?? "working") === "working";
  const unilateral = set.side != null && set.side !== "bilateral";
  const timed = set.logging_mode === "timed";
  return {
    sets: working ? (unilateral ? 0.5 : 1) : 0,
    seconds: timed && set.set_role !== "warmup" ? (set.duration_seconds ?? 0) : 0,
    kg:
      set.set_role === "warmup" || timed
        ? 0
        : (set.weight_kg ?? 0) *
          (set.reps ?? 0) *
          (set.load_convention === "per_hand" && !unilateral ? 2 : 1),
  };
}
export const policySchema = z
  .object({
    rule: z.enum(["off", "double", "duration"]),
    working_sets: z.number().int().min(1).max(100),
    reps_min: z.number().int().min(1).max(1000).nullable(),
    reps_max: z.number().int().min(1).max(1000).nullable(),
    duration_target: z.number().int().min(1).max(86400).nullable(),
    increment: z.number().positive().max(1000),
    rpe_ceiling: z.number().min(1).max(10),
    upper_limit: z.number().positive().nullable(),
    revision: z.number().int().positive(),
    allow_imported: z.boolean().default(false),
  })
  .superRefine((p, c) => {
    if (p.rule === "double" && (!p.reps_min || !p.reps_max || p.reps_max < p.reps_min))
      c.addIssue({ code: "custom", message: "Set a valid rep range." });
    if (p.rule === "duration" && (!p.duration_target || !Number.isInteger(p.increment)))
      c.addIssue({
        code: "custom",
        message: "Timed rules require a duration and whole-second increment.",
      });
  });
export type TrainingPolicy = z.infer<typeof policySchema>;
export type TrainingSuggestion = {
  action: "off" | "baseline" | "hold" | "advance" | "override";
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  reason: string;
  revision: number;
};
export function suggestTraining(raw: TrainingPolicy, sets: PerformanceSet[]): TrainingSuggestion {
  const p = policySchema.parse(raw);
  const work = sets.filter((s) => (s.set_role ?? "working") === "working");
  const result: TrainingSuggestion = {
    action: "hold",
    weight_kg: work[0]?.weight_kg ?? null,
    reps: p.reps_min,
    duration_seconds: p.duration_target,
    reason: "",
    revision: p.revision,
  };
  const hold = (reason: string) => ({ ...result, reason });
  if (p.rule === "off")
    return { ...result, action: "off", reason: "Coach has not enabled progression." };
  if (!work.length)
    return {
      ...result,
      action: "baseline",
      reason: "Record an initial working performance; no load is invented.",
    };
  const unilateral = work.some((s) => s.side && s.side !== "bilateral");
  if (unilateral) {
    const pairs = new Map<string, Set<string>>();
    for (const s of work) {
      if (!s.pair_id) return hold("A unilateral pair is incomplete.");
      const sides = pairs.get(s.pair_id) ?? new Set();
      sides.add(s.side ?? "bilateral");
      pairs.set(s.pair_id, sides);
    }
    if (
      pairs.size !== p.working_sets ||
      work.length !== p.working_sets * 2 ||
      [...pairs.values()].some((s) => !s.has("left") || !s.has("right"))
    )
      return hold("Complete both sides of every prescribed working set.");
  } else if (work.length !== p.working_sets) return hold("Complete every prescribed working set.");
  if (work.some((s) => s.rpe == null)) return hold("Hold: an effort rating is missing.");
  if (work.some((s) => s.rpe! > p.rpe_ceiling))
    return hold("Hold: effort exceeded the coach's RPE ceiling.");
  if (work.some((s) => (s.weight_kg ?? 0) !== (work[0]?.weight_kg ?? 0)))
    return hold("Mixed working loads require coach review.");
  if (p.rule === "duration") {
    if (work.some((s) => (s.duration_seconds ?? 0) < p.duration_target!))
      return hold("Hold: a duration target was missed.");
    const next = p.duration_target! + p.increment;
    if (next > Math.min(p.upper_limit ?? 86400, 86400))
      return hold("Coach's upper duration limit reached.");
    return {
      ...result,
      action: "advance",
      duration_seconds: next,
      reason: "Every working hold reached its target within the effort ceiling.",
    };
  }
  if (work.some((s) => (s.reps ?? 0) < p.reps_min!)) return hold("Hold: a rep target was missed.");
  if (work.every((s) => s.reps! >= p.reps_max!)) {
    if (result.weight_kg == null) return hold("Enter an initial load before increasing it.");
    const next = Math.round((result.weight_kg + p.increment) * 100) / 100;
    if (next > Math.min(p.upper_limit ?? 1000, 1000))
      return hold("Coach's upper load limit reached.");
    return {
      ...result,
      action: "advance",
      weight_kg: next,
      reps: p.reps_min,
      reason: "Every working set reached the top of the rep range within the effort ceiling.",
    };
  }
  return {
    ...result,
    action: "advance",
    reps: Math.min(p.reps_max!, Math.min(...work.map((s) => s.reps!)) + 1),
    reason: "Keep the load and add one rep toward the top of the range.",
  };
}
