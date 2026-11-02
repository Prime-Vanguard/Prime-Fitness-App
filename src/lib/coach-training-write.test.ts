import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("./coach-member-access", () => ({ coachMemberAccess: vi.fn() }));
import { supabase } from "@/integrations/supabase/client";
import { coachMemberAccess } from "./coach-member-access";
import { saveCoachSchedule, saveCoachPolicy } from "./coach-training-write";
import type { PolicyRow } from "./coach-policy";
const actor = crypto.randomUUID(),
  member = crypto.randomUUID(),
  assignment = { id: crypto.randomUUID(), program_version_id: crypto.randomUUID() };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(coachMemberAccess).mockResolvedValue({
    id: member,
    display_name: "Member",
    email: null,
  });
});
function mock(results: unknown[]) {
  const filters: unknown[][] = [];
  vi.mocked(supabase.from).mockImplementation((table) => {
    const result = results.shift();
    const query = {
      select: () => query,
      update: () => query,
      insert: () => query,
      eq: (...args: unknown[]) => {
        filters.push([table, ...args]);
        return query;
      },
      maybeSingle: () => Promise.resolve(result),
    };
    return query as never;
  });
  return filters;
}
const ok = { data: { id: assignment.id }, error: null };
it("reconciles a previously applied schedule without re-planning moved sessions", async () => {
  const target = { mode: "rotation", start_date: "2026-10-20" };
  mock([ok, { data: target, error: null }]);
  await saveCoachSchedule(actor, member, assignment, target, null);
  expect(supabase.rpc).not.toHaveBeenCalled();
});
it("refuses a stale schedule before calling the configuration RPC", async () => {
  mock([ok, { data: { mode: "calendar", start_date: "2026-10-21" }, error: null }]);
  await expect(
    saveCoachSchedule(
      actor,
      member,
      assignment,
      { mode: "rotation", start_date: "2026-10-20" },
      null,
    ),
  ).rejects.toThrow("another tab");
  expect(supabase.rpc).not.toHaveBeenCalled();
});
it("requires a matching readback after a schedule write", async () => {
  mock([ok, { data: null, error: null }, { data: null, error: null }]);
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
  await expect(
    saveCoachSchedule(
      actor,
      member,
      assignment,
      { mode: "calendar", start_date: "2026-10-20" },
      null,
    ),
  ).rejects.toThrow("not confirmed");
  expect(supabase.rpc).toHaveBeenCalledWith(
    "configure_program_schedule",
    expect.objectContaining({ _expected: null }),
  );
});
it("guards existing policy writes by member and revision and rejects zero-row success", async () => {
  const original = { id: crypto.randomUUID(), revision: 4 } as PolicyRow,
    filters = mock([ok, { data: null, error: null }]);
  await expect(
    saveCoachPolicy(actor, member, assignment, "slot", "exercise", {} as never, original),
  ).rejects.toThrow("changed");
  expect(filters).toContainEqual(["training_policies", "revision", 4]);
  expect(filters).toContainEqual(["training_policies", "member_id", member]);
});
it("retains a new-policy draft when another tab already created its slot", async () => {
  mock([ok, { data: null, error: { code: "23505" } }]);
  await expect(
    saveCoachPolicy(actor, member, assignment, "slot", "exercise", {} as never),
  ).rejects.toThrow("another tab");
});
it("rechecks staff access before writing any coaching changes", async () => {
  vi.mocked(coachMemberAccess).mockResolvedValue(null);
  await expect(
    saveCoachSchedule(
      actor,
      member,
      assignment,
      { mode: "rotation", start_date: "2026-10-20" },
      null,
    ),
  ).rejects.toThrow("access");
  expect(supabase.from).not.toHaveBeenCalled();
});
