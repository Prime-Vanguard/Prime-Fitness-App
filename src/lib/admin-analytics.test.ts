import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { supabase } from "@/integrations/supabase/client";
import { adminAnalytics } from "./admin-analytics";
beforeEach(() => vi.resetAllMocks());
const empty = () => ({
  asOf: "2026-10-26T10:00:00Z",
  period: { from7: "2026-10-20", from30: "2026-09-27", to: "2026-10-26" },
  kpi: {
    members: 0,
    activeMembers: 0,
    engaged7: 0,
    workouts7: 0,
    workouts30: 0,
    pvIssued: 0,
    pendingClaims: 0,
    pendingRedemptions: 0,
  },
  rows: [],
});
it("fails on server errors instead of substituting zero totals", async () => {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: null,
    error: { message: "Aggregation failed" },
  } as never);
  await expect(adminAnalytics()).rejects.toMatchObject({ message: "Aggregation failed" });
});
it("rejects incomplete snapshots and accepts a complete empty organization", async () => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: empty(), error: null } as never);
  expect((await adminAnalytics()).kpi.members).toBe(0);
  const partial = empty();
  partial.kpi.members = 1;
  vi.mocked(supabase.rpc).mockResolvedValue({ data: partial, error: null } as never);
  await expect(adminAnalytics()).rejects.toThrow("incomplete");
});
