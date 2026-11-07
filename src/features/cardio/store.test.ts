import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(), auth: { getSession: vi.fn() } },
}));
import { supabase } from "@/integrations/supabase/client";
import { readMemberState } from "@/lib/member-store";
import { activityDay } from "@/lib/dates";
import {
  cardioState,
  saveCardio,
  syncCardio,
  resolveCardio,
  cacheCardio,
  mergeCardioRecovery,
  saveIntervalTimer,
  completeIntervalTimer,
} from "./store";
let user: string;
const data = () => ({
  activity: "run" as const,
  log_date: activityDay(),
  duration_seconds: 600,
  distance_m: 1000,
  incline_pct: null,
  resistance: null,
  heart_rate: null,
  notes: "",
  intervals: null,
});
const state = async () => cardioState((await readMemberState(user)).references);
beforeEach(() => {
  vi.resetAllMocks();
  user = crypto.randomUUID();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: user } } },
    error: null,
  } as never);
});
it("commits a completed interval timer and its queued log once in one durable operation", async () => {
  const timer = {
    id: crypto.randomUUID(),
    plan: { work: 30, rest: 10, rounds: 2, prepare: 0 },
    elapsed: 70,
    anchor: null,
    log_date: activityDay(),
    saved: false,
  };
  await saveIntervalTimer(user, timer);
  await completeIntervalTimer(user, timer);
  await completeIntervalTimer(user, timer);
  const saved = await state();
  expect(saved.timer?.saved).toBe(true);
  expect(saved.records).toHaveLength(1);
  expect(saved.queue).toHaveLength(1);
  expect(saved.records[0]?.duration_seconds).toBe(70);
});
function online(response: unknown) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.mocked(supabase.rpc).mockReturnValue({
    abortSignal: () => Promise.resolve({ data: response, error: null }),
  } as never);
}
it("durably saves, retains pending old records during pruning, and isolates members", async () => {
  const id = await saveCardio(user, { ...data(), log_date: "2020-01-01" });
  await cacheCardio(user, []);
  expect((await state()).records[0]?.id).toBe(id);
  expect((await state()).queue).toHaveLength(1);
  expect(cardioState((await readMemberState(crypto.randomUUID())).references).records).toEqual([]);
  expect(() => mergeCardioRecovery({}, { cardioState: awaitNever() }, user)).toThrow();
});
function awaitNever() {
  return {
    records: [{ ...data(), id: crypto.randomUUID(), member_id: crypto.randomUUID(), revision: 1 }],
    queue: [],
    timer: null,
    lastSync: null,
  };
}
it("replays a stable mutation after a lost acknowledgement and merges late replies without losing edits", async () => {
  const id = await saveCardio(user, data());
  const initial = await state();
  const op = initial.queue[0]!;
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  let reply!: (v: unknown) => void;
  vi.mocked(supabase.rpc).mockReturnValue({
    abortSignal: () =>
      new Promise((resolve) => {
        reply = resolve;
      }),
  } as never);
  const sync = syncCardio(user);
  await vi.waitFor(() => expect(reply).toBeTypeOf("function"));
  await saveCardio(user, { ...data(), duration_seconds: 900 }, id, 1);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  reply({ data: { status: "applied", record: initial.records[0], revision: 1 }, error: null });
  await sync;
  const later = await state();
  expect(later.records[0]?.duration_seconds).toBe(900);
  expect(later.queue).toHaveLength(1);
  expect(later.queue[0]?.id).not.toBe(op.id);
  online({ status: "applied", record: later.records[0], revision: 2 });
  await syncCardio(user);
  expect((await state()).queue).toHaveLength(0);
});
it("retains conflicts for explicit review and pauses for another signed-in member", async () => {
  const id = await saveCardio(user, data()),
    local = await state();
  online({
    status: "conflict",
    record: { ...local.records[0], revision: 5, duration_seconds: 1200 },
    revision: 5,
  });
  await syncCardio(user);
  const conflict = await state();
  expect(conflict.queue[0]?.status).toBe("conflict");
  expect(conflict.records[0]?.duration_seconds).toBe(600);
  await resolveCardio(user, conflict.queue[0]!.id, true);
  const retry = await state();
  expect(retry.queue[0]?.expected).toBe(5);
  expect(retry.records[0]?.revision).toBe(6);
  vi.mocked(supabase.rpc).mockClear();
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: crypto.randomUUID() } } },
    error: null,
  } as never);
  await syncCardio(user);
  expect(supabase.rpc).not.toHaveBeenCalled();
  expect((await state()).records[0]?.id).toBe(id);
});
it("restores pending data without overwriting newer device state and protects timers across tabs", async () => {
  const id = await saveCardio(user, data()),
    old = (await readMemberState(user)).references;
  await saveCardio(user, { ...data(), duration_seconds: 900 }, id, 1);
  const current = (await readMemberState(user)).references;
  expect(cardioState(mergeCardioRecovery(current, old, user)).records[0]?.duration_seconds).toBe(
    900,
  );
  expect(cardioState(mergeCardioRecovery({}, old, user)).queue).toHaveLength(1);
  const timer = {
    id: crypto.randomUUID(),
    plan: { work: 30, rest: 10, rounds: 2, prepare: 0 },
    elapsed: 0,
    anchor: Date.now(),
    log_date: activityDay(),
    saved: false,
  };
  await saveIntervalTimer(user, timer);
  await expect(saveIntervalTimer(user, { ...timer, id: crypto.randomUUID() })).rejects.toThrow(
    "already open",
  );
  await saveIntervalTimer(user, { ...timer, elapsed: 10, anchor: null }, timer.id, timer);
  await expect(saveIntervalTimer(user, null, timer.id, timer)).rejects.toThrow("changed");
});
