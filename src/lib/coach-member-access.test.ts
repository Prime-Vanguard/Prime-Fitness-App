import { expect, it, vi, beforeEach } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
import { supabase } from "@/integrations/supabase/client";
import { coachMemberAccess } from "./coach-member-access";
const actor = crypto.randomUUID(),
  member = crypto.randomUUID(),
  profile = { id: member, display_name: "Member", email: "member@test.invalid" };
beforeEach(() => vi.resetAllMocks());
function mock(results: unknown[]) {
  const filters: unknown[][] = [];
  vi.mocked(supabase.from).mockImplementation((table) => {
    const result = results.shift();
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => {
        filters.push([table, ...args]);
        return query;
      },
      maybeSingle: () => Promise.resolve(result),
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return query as never;
  });
  return filters;
}
it("permits an active administrator and scopes the member profile read", async () => {
  const filters = mock([
    { data: { access_active: true }, error: null },
    { data: [{ role: "admin" }], error: null },
    { data: profile, error: null },
  ]);
  expect(await coachMemberAccess(actor, member)).toEqual(profile);
  expect(filters).toContainEqual(["profiles", "id", member]);
});
it("rechecks an active coach assignment for this actor and member", async () => {
  const filters = mock([
    { data: { access_active: true }, error: null },
    { data: [{ role: "coach" }], error: null },
    { data: { member_id: member }, error: null },
    { data: profile, error: null },
  ]);
  expect(await coachMemberAccess(actor, member)).toEqual(profile);
  expect(filters).toEqual(
    expect.arrayContaining([
      ["coach_assignments", "member_id", member],
      ["coach_assignments", "coach_id", actor],
      ["coach_assignments", "active", true],
    ]),
  );
});
it("does not read private member data for a former coach", async () => {
  mock([
    { data: { access_active: true }, error: null },
    { data: [{ role: "coach" }], error: null },
    { data: null, error: null },
  ]);
  expect(await coachMemberAccess(actor, member)).toBeNull();
  expect(supabase.from).toHaveBeenCalledTimes(3);
});
it("does not grant Pod leaders or ordinary members the coaching workspace", async () => {
  for (const role of ["pod_leader", "member"]) {
    mock([
      { data: { access_active: true }, error: null },
      { data: [{ role }], error: null },
    ]);
    expect(await coachMemberAccess(actor, member)).toBeNull();
  }
});
it("blocks paused staff before requesting member information", async () => {
  mock([
    { data: { access_active: false }, error: null },
    { data: [{ role: "super_admin" }], error: null },
  ]);
  expect(await coachMemberAccess(actor, member)).toBeNull();
  expect(supabase.from).toHaveBeenCalledTimes(2);
});
it("keeps a failed access check distinct from missing permission", async () => {
  mock([
    { data: { access_active: true }, error: null },
    { data: null, error: new Error("Offline") },
  ]);
  await expect(coachMemberAccess(actor, member)).rejects.toThrow("Offline");
});
