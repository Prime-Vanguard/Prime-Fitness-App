import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), read: vi.fn(), write: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/lib/member-store", () => ({
  readMemberState: mocks.read,
  changeMemberState: mocks.write,
}));
import { useTrainingFeatures } from "./use-training-features";

let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  mocks.write.mockResolvedValue(undefined);
  mocks.read.mockResolvedValue({ references: {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
it("keeps authorized online flags when optional caching fails, shared by every observer", async () => {
  mocks.rpc.mockResolvedValue({ data: { food_scanning: true }, error: null });
  mocks.write.mockRejectedValue(new DOMException("Storage full", "QuotaExceededError"));
  const { result } = renderHook(
    () => [useTrainingFeatures("member-a"), useTrainingFeatures("member-a")],
    { wrapper },
  );
  await waitFor(() => expect(result.current[0]!.isSuccess).toBe(true));
  expect(result.current.map((q) => q.data?.food_scanning)).toEqual([true, true]);
  expect(result.current.map((q) => q.offlineCacheUnavailable)).toEqual([true, true]);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it("does not use stale cached permission when the online authorization request fails", async () => {
  mocks.read.mockResolvedValue({ references: { trainingFeatures: { food_scanning: true } } });
  mocks.rpc.mockResolvedValue({ data: null, error: new Error("Unavailable") });
  const { result } = renderHook(() => useTrainingFeatures("member-a"), { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
  expect(mocks.read).not.toHaveBeenCalled();
});
it("reads member-scoped offline flags without enabling an unknown feature", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  mocks.read.mockImplementation(async (id) => ({
    references: id === "member-a" ? { trainingFeatures: { food_scanning: false } } : {},
  }));
  const { result, rerender } = renderHook(({ member }) => useTrainingFeatures(member), {
    initialProps: { member: "member-a" },
    wrapper,
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.food_scanning).toBe(false);
  rerender({ member: "member-b" });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.food_scanning).toBeUndefined();
  expect(mocks.read).toHaveBeenCalledWith("member-b");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects malformed feature responses rather than treating truthy text as authorization", async () => {
  mocks.rpc.mockResolvedValue({ data: { food_scanning: "true" }, error: null });
  const { result } = renderHook(() => useTrainingFeatures("member-a"), { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
  expect(mocks.write).not.toHaveBeenCalled();
});
