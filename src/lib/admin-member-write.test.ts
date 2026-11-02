import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
import { supabase } from "@/integrations/supabase/client";
import { saveAdminTargets, saveMemberChange, type TargetRow } from "./admin-member-write";

const actor = "admin",
  member = "member";
const values = { calories: 2400, protein_g: 150, carbs_g: 250, fat_g: 70, water_ml: 2500 };
const original: TargetRow = {
  ...values,
  calories: 2200,
  member_id: member,
  set_by: actor,
  updated_at: "2026-10-29T00:00:00Z",
};
type Result = { data: unknown; error: unknown };
const ok = (data: unknown): Result => ({ data, error: null });
function setup(results: Result[], role = "admin", active = true) {
  const pending = [ok({ access_active: active }), ok([{ role }]), ...results];
  const operations: unknown[][] = [];
  vi.mocked(supabase.from).mockImplementation((table) => {
    const result = pending.shift();
    if (!result) throw new Error("Unexpected request");
    const builder: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve),
    };
    for (const method of ["select", "eq", "is", "insert", "delete", "update"])
      builder[method] = (...args: unknown[]) => {
        operations.push([table, method, ...args]);
        return builder;
      };
    builder["maybeSingle"] = builder["single"] = () => Promise.resolve(result);
    return builder as never;
  });
  return operations;
}
beforeEach(() => vi.resetAllMocks());
it("rechecks active administrator access before a member mutation", async () => {
  const ops = setup([], "admin", false);
  await expect(saveMemberChange(actor, { kind: "access", member, active: false })).rejects.toThrow(
    "Active administrator",
  );
  expect(ops.some((op) => op[1] === "update")).toBe(false);
});
it("rejects a former administrator even when their profile is active", async () => {
  setup([], "member");
  await expect(saveAdminTargets(actor, member, values, original)).rejects.toThrow("administrator");
});
it("protects self access and super administrator roles", async () => {
  setup([]);
  await expect(
    saveMemberChange(actor, { kind: "access", member: actor, active: false }),
  ).rejects.toThrow("own access");
  setup([ok([{ role: "super_admin" }])], "super_admin");
  await expect(
    saveMemberChange(actor, { kind: "role", member, role: "coach", grant: false }),
  ).rejects.toThrow("protected");
});
it("requires a fresh super administrator role to grant admin", async () => {
  setup([ok([])]);
  await expect(
    saveMemberChange(actor, { kind: "role", member, role: "admin", grant: true }),
  ).rejects.toThrow("cannot manage");
});
it("rejects a zero-row access acknowledgement", async () => {
  setup([ok([]), ok(null)]);
  await expect(saveMemberChange(actor, { kind: "access", member, active: false })).rejects.toThrow(
    "not confirmed",
  );
});
it("reconciles an already applied role without a second insert", async () => {
  const ops = setup([ok([{ role: "coach" }])]);
  await saveMemberChange(actor, { kind: "role", member, role: "coach", grant: true });
  expect(ops.some((op) => op[1] === "insert")).toBe(false);
});
it("keeps the guarded coach RPC and verifies its assignment readback", async () => {
  setup([ok({ coach_id: "other" })]);
  vi.mocked(supabase.rpc).mockResolvedValue(ok(null) as never);
  await expect(saveMemberChange(actor, { kind: "coach", member, coach: "next" })).rejects.toThrow(
    "not confirmed",
  );
  expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith("set_member_coach", {
    _member: member,
    _coach: "next",
  });
});
it("retains a target draft when another editor changed the saved values", async () => {
  const ops = setup([ok({ ...original, calories: 2300 })]);
  await expect(saveAdminTargets(actor, member, values, original)).rejects.toThrow("another tab");
  expect(ops.some((op) => op[1] === "update")).toBe(false);
});
it("uses member, timestamp and nullable field comparisons for target updates", async () => {
  const baseline = { ...original, carbs_g: null };
  const ops = setup([ok(baseline), ok({ ...original, ...values })]);
  await saveAdminTargets(actor, member, values, baseline);
  expect(ops).toContainEqual(["nutrition_targets", "eq", "member_id", member]);
  expect(ops).toContainEqual(["nutrition_targets", "eq", "updated_at", original.updated_at]);
  expect(ops).toContainEqual(["nutrition_targets", "is", "carbs_g", null]);
});
it("reconciles target acknowledgement loss without another write", async () => {
  const ops = setup([ok({ ...original, ...values })]);
  await saveAdminTargets(actor, member, values, original);
  expect(ops.some((op) => op[1] === "update" || op[1] === "insert")).toBe(false);
});
it("requires a returned target row before success", async () => {
  setup([ok(original), ok(null)]);
  await expect(saveAdminTargets(actor, member, values, original)).rejects.toThrow("not confirmed");
});
it("uses insert for new targets so a concurrent creation cannot be overwritten", async () => {
  const ops = setup([
    ok(null),
    { data: null, error: { message: "Duplicate member target", code: "23505" } },
  ]);
  await expect(saveAdminTargets(actor, member, values, null)).rejects.toMatchObject({
    code: "23505",
  });
  expect(ops.some((op) => op[1] === "insert")).toBe(true);
  expect(ops.some((op) => op[1] === "update")).toBe(false);
});
