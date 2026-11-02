import { inputNumber } from "./numeric-input";
import { policySchema } from "./training-model";
import type { VersionItem } from "./program-versions";
import type { Tables, Json } from "@/integrations/supabase/types";
export type PolicyRow = Tables<"training_policies">;
export type PolicyDraft = {
  rule: "off" | "double" | "duration";
  working_sets: string;
  reps_min: string;
  reps_max: string;
  duration_target: string;
  increment: string;
  rpe_ceiling: string;
  upper_limit: string;
  allow_imported: boolean;
  overrideAction: "keep" | "replace" | "remove";
  reason: string;
  weight: string;
  reps: string;
  seconds: string;
};
export function policyDraft(item: VersionItem, policy?: PolicyRow): PolicyDraft {
  return {
    rule: (policy?.rule as PolicyDraft["rule"]) ?? "off",
    working_sets: String(policy?.working_sets ?? item.target_sets),
    reps_min: String(policy?.reps_min ?? 8),
    reps_max: String(policy?.reps_max ?? 12),
    duration_target: String(policy?.duration_target ?? 30),
    increment: String(policy?.increment ?? (item.logging_mode === "timed" ? 5 : 2.5)),
    rpe_ceiling: String(policy?.rpe_ceiling ?? 8),
    upper_limit: policy?.upper_limit == null ? "" : String(policy.upper_limit),
    allow_imported: policy?.allow_imported ?? false,
    overrideAction: "keep",
    reason: "",
    weight: "",
    reps: "",
    seconds: "",
  };
}
export function preparePolicy(item: VersionItem, draft: PolicyDraft, original?: PolicyRow) {
  const timed = item.logging_mode === "timed";
  if ((timed && draft.rule === "double") || (!timed && draft.rule === "duration"))
    throw new Error("Choose a rule matching this exercise's logging mode.");
  const number = (value: string, label: string) => inputNumber(value, { label, max: 86400 });
  const inactive = policyDraft(item, original);
  const parsed = policySchema.parse({
    rule: draft.rule,
    working_sets: number(
      draft.rule === "off" ? inactive.working_sets : draft.working_sets,
      "Working sets",
    ),
    reps_min: draft.rule === "double" ? number(draft.reps_min, "Minimum reps") : null,
    reps_max: draft.rule === "double" ? number(draft.reps_max, "Maximum reps") : null,
    duration_target:
      draft.rule === "duration" ? number(draft.duration_target, "Hold seconds") : null,
    increment: number(draft.rule === "off" ? inactive.increment : draft.increment, "Increment"),
    rpe_ceiling: number(
      draft.rule === "off" ? inactive.rpe_ceiling : draft.rpe_ceiling,
      "RPE ceiling",
    ),
    upper_limit: draft.rule === "off" ? null : number(draft.upper_limit, "Upper target limit"),
    allow_imported: draft.allow_imported,
    revision: original?.revision ?? 1,
  });
  let override: Json = original?.override ?? null;
  if (
    draft.overrideAction === "keep" &&
    override &&
    typeof override === "object" &&
    !Array.isArray(override)
  )
    override = { ...override, issued_at: override["issued_at"] ?? original!.updated_at };
  if (draft.overrideAction === "remove") override = null;
  if (draft.overrideAction === "replace") {
    const reason = draft.reason.trim();
    if (!reason || reason.length > 2000)
      throw new Error("Give the override a reason (up to 2,000 characters).");
    const weight = inputNumber(draft.weight, { label: "Override kg", max: 1000 });
    const reps = timed
      ? null
      : inputNumber(draft.reps, { label: "Override reps", min: 1, max: 1000, integer: true });
    const seconds = timed
      ? inputNumber(draft.seconds, { label: "Override seconds", min: 1, max: 86400, integer: true })
      : null;
    if (timed ? seconds == null : reps == null && weight == null)
      throw new Error("Enter the override target for this exercise mode.");
    override = { reason, weight_kg: weight, reps, duration_seconds: seconds };
  }
  const { revision: _revision, ...policy } = parsed;
  return { ...policy, override };
}
