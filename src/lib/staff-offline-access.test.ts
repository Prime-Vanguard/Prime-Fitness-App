import { beforeEach, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { readOfflineIdentity } from "./offline-access";
import { loadStaffSummaryMember, verifyStaffDownloadAuthority } from "./staff-offline-access";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), auth: { getUser: vi.fn(), getSession: vi.fn() } },
}));
vi.mock("./offline-access", async (original) => ({
  ...(await original<typeof import("./offline-access")>()),
  readOfflineIdentity: vi.fn(),
}));

const actor = crypto.randomUUID();
const memberId = crypto.randomUUID();
let roles: string[];
let active: boolean;
let coached: boolean;
let podMember: boolean;
let memberReads: number;
beforeEach(() => {
  vi.clearAllMocks();
  roles = ["coach"];
  active = true;
  coached = false;
  podMember = false;
  memberReads = 0;
  vi.mocked(readOfflineIdentity).mockReturnValue({ id: actor });
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: actor } },
    error: null,
  } as never);
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: actor }, access_token: "fixture" } },
    error: null,
  } as never);
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const filters = new Map<string, unknown>();
    const respond = () => {
      if (table === "user_roles") return { data: roles.map((role) => ({ role })), error: null };
      if (table === "coach_assignments") {
        expect(Object.fromEntries(filters)).toEqual({
          coach_id: actor,
          member_id: memberId,
          active: true,
        });
        return { data: coached ? { member_id: memberId } : null, error: null };
      }
      if (table === "pods") {
        expect(Object.fromEntries(filters)).toEqual({
          leader_id: actor,
          "pod_members.member_id": memberId,
        });
        return { data: podMember ? { pod_members: [{ member_id: memberId }] } : null, error: null };
      }
      if (filters.get("id") === actor)
        return { data: { id: actor, access_active: active }, error: null };
      memberReads++;
      return { data: { id: memberId, display_name: "Member" }, error: null };
    };
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => {
        filters.set(key, value);
        return query;
      },
      setHeader: (key: string, value: string) => {
        expect([key, value]).toEqual(["Authorization", "Bearer fixture"]);
        return query;
      },
      abortSignal: () => query,
      limit: () => query,
      maybeSingle: async () => respond(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(respond()).then(resolve),
    };
    return query as never;
  });
});

it.each([
  ["coach", true, false, true],
  ["coach", false, false, false],
  ["pod_leader", false, true, true],
  ["pod_leader", true, false, false],
  ["admin", false, false, true],
])(
  "%s only reads the selected member after an authorized relationship",
  async (role, coach, pod, allowed) => {
    roles = [role];
    coached = coach;
    podMember = pod;
    const authority = await verifyStaffDownloadAuthority(actor);
    expect(authority).not.toBeNull();
    expect(!!(await loadStaffSummaryMember(authority!, memberId))).toBe(allowed);
    expect(memberReads).toBe(allowed ? 1 : 0);
  },
);

it("refuses paused staff, removed roles, and a switched session", async () => {
  active = false;
  await expect(verifyStaffDownloadAuthority(actor)).resolves.toBeNull();
  active = true;
  roles = ["member"];
  await expect(verifyStaffDownloadAuthority(actor)).resolves.toBeNull();
  vi.mocked(readOfflineIdentity).mockReturnValue({ id: memberId });
  await expect(verifyStaffDownloadAuthority(actor)).rejects.toThrow("same staff account");
  expect(memberReads).toBe(0);
});
