import { beforeEach, expect, it, vi } from "vitest";
import { getTrainingSuggestion } from "./training-suggestions";
import { supabase } from "@/integrations/supabase/client";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn() }, rpc: vi.fn() },
}));
const data = { memberId: "00000000-0000-4000-8000-000000000001", slot: "slot-1" };
beforeEach(() => vi.resetAllMocks());
it("rejects malformed requests before accessing member data", async () => {
  await expect(getTrainingSuggestion({ data: { ...data, memberId: "invalid" } })).rejects.toThrow();
  expect(supabase.auth.getUser).not.toHaveBeenCalled();
  expect(supabase.rpc).not.toHaveBeenCalled();
});
it("requires a verified signed-in session", async () => {
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: null },
    error: null,
  } as never);
  await expect(getTrainingSuggestion({ data })).rejects.toThrow("Sign in");
  expect(supabase.rpc).not.toHaveBeenCalled();
});
it("uses the guarded RPC for the requested member and preserves permission errors", async () => {
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: "coach" } },
    error: null,
  } as never);
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: null,
    error: { message: "Not authorized" },
  } as never);
  await expect(getTrainingSuggestion({ data })).rejects.toThrow("Not authorized");
  expect(supabase.rpc).toHaveBeenCalledWith("get_training_context", {
    _member: data.memberId,
    _slot: data.slot,
  });
});
