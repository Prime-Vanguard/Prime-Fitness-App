import {
  policySchema,
  suggestTraining,
  type PerformanceSet,
  type TrainingSuggestion,
  type TrainingPolicy,
} from "./training-model";
export type TrainingContext = {
  policy: TrainingPolicy & {
    updated_at: string;
    exercise_id: string;
    override: {
      reason: string;
      weight_kg: number | null;
      reps: number | null;
      duration_seconds: number | null;
      issued_at?: string;
    } | null;
  };
  session: { id: string; finished_at: string } | null;
  sets: PerformanceSet[];
  expected?: {
    logging_mode: "weighted_reps" | "bodyweight_reps" | "timed";
    load_convention: "external_total" | "per_hand" | "bodyweight";
  };
};
export function contextSuggestion(context: TrainingContext): TrainingSuggestion {
  const policy = policySchema.parse(context.policy);
  if (policy.rule === "off") return suggestTraining(policy, []);
  if (
    !context.expected ||
    context.sets.some(
      (s) =>
        (s.set_role ?? "working") === "working" &&
        ((s.logging_mode ?? "weighted_reps") !== context.expected!.logging_mode ||
          (s.load_convention ?? "external_total") !== context.expected!.load_convention),
    )
  ) {
    return {
      action: "baseline",
      weight_kg: null,
      reps: policy.reps_min,
      duration_seconds: policy.duration_target,
      reason:
        "No comparable baseline for this measurement convention. Record an initial working performance.",
      revision: policy.revision,
    };
  }
  const result = suggestTraining(policy, context.sets);
  const override = context.policy["override"] as {
    reason: string;
    weight_kg: number | null;
    reps: number | null;
    duration_seconds: number | null;
    issued_at?: string;
  } | null;
  const updated = Date.parse(override?.issued_at ?? String(context.policy["updated_at"] ?? ""));
  const completedAt = Date.parse(context.session?.finished_at ?? "");
  const work = context.sets.filter((s) => (s.set_role ?? "working") === "working");
  const pairs = new Map<string, Set<string>>();
  for (const s of work) {
    if (s.pair_id) {
      const sides = pairs.get(s.pair_id) ?? new Set<string>();
      sides.add(s.side ?? "bilateral");
      pairs.set(s.pair_id, sides);
    }
  }
  const unilateral = work.some((s) => s.side && s.side !== "bilateral");
  const complete = unilateral
    ? work.length === policy.working_sets * 2 &&
      pairs.size === policy.working_sets &&
      [...pairs.values()].every((s) => s.size === 2 && s.has("left") && s.has("right"))
    : work.length === policy.working_sets;
  if (
    override &&
    (!context.session ||
      !Number.isFinite(updated) ||
      !Number.isFinite(completedAt) ||
      completedAt <= updated ||
      !complete)
  )
    return {
      ...result,
      action: "override",
      weight_kg: override.weight_kg,
      reps: override.reps,
      duration_seconds: override.duration_seconds,
      reason: override.reason,
    };
  return result;
}
