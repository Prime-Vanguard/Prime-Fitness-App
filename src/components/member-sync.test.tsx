import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => client }));
vi.mock("@/hooks/use-member-data", () => ({ useMemberData: () => ({ state: {}, error: "" }) }));
vi.mock("./member-sync-panel", () => ({ MemberSyncPanel: () => null }));
vi.mock("@/lib/member-store", () => ({ syncMemberEntries: vi.fn(), watchMemberSync: vi.fn() }));
import { syncMemberEntries, watchMemberSync } from "@/lib/member-store";
import { MemberSync } from "./member-sync";
const client = { invalidateQueries: vi.fn().mockResolvedValue(undefined) };
let root: Root;
let notice: () => void;
const stop = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.mocked(syncMemberEntries).mockResolvedValue(undefined);
  vi.mocked(watchMemberSync).mockImplementation((_user, callback) => {
    notice = callback;
    return stop;
  });
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function mount(user = "member") {
  await act(async () => root.render(<MemberSync userId={user} />));
}
it("keeps 15-second queue retries without no-op invalidations and refreshes remotely once a minute", async () => {
  await mount();
  await act(async () => vi.advanceTimersByTime(45000));
  expect(syncMemberEntries).toHaveBeenCalledTimes(4);
  expect(client.invalidateQueries).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(15000));
  expect(client.invalidateQueries).toHaveBeenCalledTimes(6);
  for (const [options] of client.invalidateQueries.mock.calls)
    expect(options.queryKey[1]).toBe("member");
});
it("refreshes immediately after acceptance rather than waiting for the timer", async () => {
  await mount();
  await act(async () => notice());
  expect(client.invalidateQueries).toHaveBeenCalledTimes(6);
  await act(async () => vi.advanceTimersByTime(15000));
  expect(client.invalidateQueries).toHaveBeenCalledTimes(6);
});
it("does not refresh after a failed queue attempt", async () => {
  vi.mocked(syncMemberEntries).mockRejectedValue(new Error("Offline"));
  await mount();
  await act(async () => vi.advanceTimersByTime(15000));
  expect(client.invalidateQueries).not.toHaveBeenCalled();
});
it("stops old account callbacks and avoids remote refreshes while hidden", async () => {
  await mount("old");
  const oldNotice = notice;
  await mount("new");
  expect(stop).toHaveBeenCalledTimes(1);
  await act(async () => oldNotice());
  expect(client.invalidateQueries).not.toHaveBeenCalled();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await act(async () => vi.advanceTimersByTime(60000));
  expect(client.invalidateQueries).not.toHaveBeenCalled();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(client.invalidateQueries).toHaveBeenCalledTimes(6);
  for (const [options] of client.invalidateQueries.mock.calls)
    expect(options.queryKey[1]).toBe("new");
});
