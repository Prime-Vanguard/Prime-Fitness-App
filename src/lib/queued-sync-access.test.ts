import { afterEach, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { authorizeQueuedSync, clearQueuedSyncDelay, delayQueuedSync } from "./queued-sync-access";
import { deviceScope } from "./device-scope";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), auth: { getUser: vi.fn() } },
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

function activeMember(memberId: string) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: memberId } },
    error: null,
  } as never);
  vi.mocked(supabase.from).mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: { id: memberId, access_active: true },
          error: null,
        }),
      }),
    }),
  } as never);
}

it("coalesces concurrent queue checks and rejects an unrelated signed-in member", async () => {
  const memberId = crypto.randomUUID();
  activeMember(memberId);
  await expect(
    Promise.all([
      authorizeQueuedSync(memberId, "records"),
      authorizeQueuedSync(memberId, "workout"),
      authorizeQueuedSync(memberId, "preferences"),
    ]),
  ).resolves.toEqual([true, true, true]);
  expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
  expect(supabase.from).toHaveBeenCalledTimes(1);
  await expect(authorizeQueuedSync(crypto.randomUUID(), "workout")).resolves.toBe(false);
  expect(supabase.from).toHaveBeenCalledTimes(1);
});

it("waits longer after repeated access failures and lets a fresh reconnect retry immediately", async () => {
  vi.useFakeTimers();
  const memberId = crypto.randomUUID();
  activeMember(memberId);
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: null },
    error: { status: 503, message: "Unavailable" },
  } as never);
  await expect(authorizeQueuedSync(memberId, "records")).resolves.toBe(false);
  await vi.advanceTimersByTimeAsync(15000);
  await expect(authorizeQueuedSync(memberId, "workout")).resolves.toBe(false);
  await vi.advanceTimersByTimeAsync(15000);
  await expect(authorizeQueuedSync(memberId, "cardio")).resolves.toBe(false);
  expect(supabase.auth.getUser).toHaveBeenCalledTimes(2);
  activeMember(memberId);
  clearQueuedSyncDelay(memberId);
  await expect(authorizeQueuedSync(memberId, "preferences")).resolves.toBe(true);
  expect(supabase.auth.getUser).toHaveBeenCalledTimes(3);
});

it("limits a failed upload's delay to that queue", async () => {
  const memberId = crypto.randomUUID();
  activeMember(memberId);
  delayQueuedSync(memberId, "cardio");
  await expect(authorizeQueuedSync(memberId, "cardio")).resolves.toBe(false);
  await expect(authorizeQueuedSync(memberId, "workout")).resolves.toBe(true);
  expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
});

it("rechecks the delay written by another tab while waiting for the shared access lock", async () => {
  const memberId = crypto.randomUUID();
  activeMember(memberId);
  let takeLock: (() => Promise<boolean>) | undefined;
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<boolean>) =>
        new Promise<boolean>((resolve) => {
          takeLock = async () => {
            const result = await callback();
            resolve(result);
            return result;
          };
        }),
    },
  });
  try {
    const check = authorizeQueuedSync(memberId, "records");
    const key = `pf-sync-retry:${deviceScope(memberId)}:access`;
    localStorage.setItem(key, JSON.stringify({ failures: 1, retryAt: Date.now() + 15000 }));
    await takeLock!();
    await expect(check).resolves.toBe(false);
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  } finally {
    Reflect.deleteProperty(navigator, "locks");
  }
});

it("uses in-memory retry delays when writing browser storage is blocked", async () => {
  const memberId = crypto.randomUUID();
  activeMember(memberId);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage blocked", "QuotaExceededError");
  });
  delayQueuedSync(memberId, "records");
  await expect(authorizeQueuedSync(memberId, "records")).resolves.toBe(false);
  await expect(authorizeQueuedSync(memberId, "workout")).resolves.toBe(true);
});
