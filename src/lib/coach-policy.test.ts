import { expect, it } from "vitest";
import { policyDraft, preparePolicy, type PolicyRow } from "./coach-policy";
import { contextSuggestion } from "./training-context";
import type { VersionItem } from "./program-versions";
const item: VersionItem = {
  id: crypto.randomUUID(),
  exercise_id: crypto.randomUUID(),
  week: 1,
  day: 1,
  target_sets: 5,
  target_reps: "Coach decides",
  position: 0,
  name_en: "Squat",
  name_ar: null,
  muscle: "quads",
  equipment: "barbell",
};
const policy: PolicyRow = {
  id: crypto.randomUUID(),
  member_id: crypto.randomUUID(),
  program_version_id: crypto.randomUUID(),
  slot_key: "slot",
  exercise_id: item.exercise_id,
  rule: "double",
  working_sets: 3,
  reps_min: 8,
  reps_max: 12,
  duration_target: null,
  increment: 2.5,
  rpe_ceiling: 8,
  upper_limit: null,
  allow_imported: false,
  revision: 4,
  updated_by: crypto.randomUUID(),
  updated_at: "2026-10-20T12:00:00Z",
  override: { reason: "Coach target", weight_kg: 35, reps: 10, duration_seconds: null },
};
it("starts unconfigured slots off without interpreting arbitrary prescriptions", () => {
  const draft = policyDraft(item);
  expect(draft.rule).toBe("off");
  expect(draft.working_sets).toBe("5");
  expect(draft.allow_imported).toBe(false);
});
it("can disable progression even when hidden inactive fields contain invalid draft text", () => {
  const draft = {
    ...policyDraft(item, policy),
    working_sets: "",
    increment: "invalid",
    rpe_ceiling: "200",
    rule: "off" as const,
  };
  expect(preparePolicy(item, draft, policy)).toMatchObject({
    rule: "off",
    working_sets: 3,
    increment: 2.5,
    rpe_ceiling: 8,
  });
});
it("keeps an existing override and its original server issue time", () => {
  const draft = policyDraft(item, policy);
  draft.working_sets = "4";
  expect(preparePolicy(item, draft, policy).override).toEqual({
    ...(policy.override as object),
    issued_at: policy.updated_at,
  });
});
it("requires explicit removal and a reason for replacement", () => {
  const draft = policyDraft(item, policy);
  draft.overrideAction = "remove";
  expect(preparePolicy(item, draft, policy).override).toBeNull();
  draft.overrideAction = "replace";
  expect(() => preparePolicy(item, draft, policy)).toThrow("reason");
  draft.reason = "Use smaller jump";
  draft.weight = "٣٠";
  expect(preparePolicy(item, draft, policy).override).toEqual({
    reason: draft.reason,
    weight_kg: 30,
    reps: null,
    duration_seconds: null,
  });
});
it("rejects incompatible rules and fractional duration increments", () => {
  const timed = { ...item, logging_mode: "timed" as const };
  const draft = policyDraft(timed);
  draft.rule = "double";
  expect(() => preparePolicy(timed, draft)).toThrow("matching");
  draft.rule = "duration";
  draft.increment = "2.5";
  expect(() => preparePolicy(timed, draft)).toThrow();
});
it("keeps unrelated policy edits from reviving an already consumed override", () => {
  const payload = preparePolicy(item, policyDraft(item, policy), policy);
  const sets = Array.from({ length: 3 }, () => ({ reps: 8, weight_kg: 50, rpe: 7 }));
  expect(
    contextSuggestion({
      policy: {
        ...payload,
        revision: 5,
        updated_at: "2026-10-30T12:00:00Z",
        exercise_id: item.exercise_id,
        override: payload.override as never,
      },
      session: { id: "s", finished_at: "2026-10-21T12:00:00Z" },
      sets,
      expected: { logging_mode: "weighted_reps", load_convention: "external_total" },
    }).action,
  ).toBe("advance");
});
it("compares equivalent offset timestamps as the same instant", () => {
  expect(
    contextSuggestion({
      policy: {
        ...policy,
        rule: "double",
        override: {
          reason: "Coach",
          weight_kg: 35,
          reps: 10,
          duration_seconds: null,
          issued_at: "2026-10-20T12:00:00+00:00",
        },
      },
      session: { id: "s", finished_at: "2026-10-20T12:00:00Z" },
      sets: Array.from({ length: 3 }, () => ({ reps: 8, weight_kg: 50, rpe: 7 })),
      expected: { logging_mode: "weighted_reps", load_convention: "external_total" },
    }).action,
  ).toBe("override");
});
