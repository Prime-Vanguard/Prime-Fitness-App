import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(), auth: { getSession: vi.fn() } },
}));
import { supabase } from "@/integrations/supabase/client";
import {
  queueMemberWrites,
  readMemberState,
  syncMemberEntries,
  cacheMemberRecords,
  beginMemberRead,
  resolveMemberConflict,
  changeMemberState,
} from "./member-store";
let user: string;
beforeEach(() => {
  vi.resetAllMocks();
  user = crypto.randomUUID();
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: user } } },
    error: null,
  } as never);
});
function backend(response: unknown, error: unknown = null) {
  vi.mocked(supabase.rpc).mockReturnValue({
    abortSignal: () => Promise.resolve({ data: response, error }),
  } as never);
}
it("retains queued data on an incomplete acknowledgement without retrying in a tight loop", async () => {
  await queueMemberWrites(user, [
    { entity: "water_logs", op: "put", record: { id: crypto.randomUUID(), ml: 250 } },
  ]);
  backend([]);
  await syncMemberEntries(user);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  const state = await readMemberState(user);
  expect(state.queue[0]).toMatchObject({
    status: "queued",
    error: expect.stringContaining("Incomplete server acknowledgement"),
  });
  expect(state.records.water_logs).toHaveLength(1);
});
it("persists concurrent entries and isolates members", async () => {
  await Promise.all(
    Array.from({ length: 10 }, () =>
      queueMemberWrites(user, [
        {
          entity: "water_logs",
          op: "put",
          record: { id: crypto.randomUUID(), log_date: "2026-10-20", ml: 250 },
        },
      ]),
    ),
  );
  expect((await readMemberState(user)).queue).toHaveLength(10);
  expect((await readMemberState(crypto.randomUUID())).queue).toHaveLength(0);
});
it("retains all unsynced entries when refreshing and pruning old cache", async () => {
  const id = crypto.randomUUID();
  await queueMemberWrites(user, [
    { entity: "water_logs", op: "put", record: { id, log_date: "2020-01-01", ml: 250 } },
  ]);
  await cacheMemberRecords(user, "water_logs", [], await beginMemberRead(user));
  expect((await readMemberState(user)).records.water_logs?.[0]?.id).toBe(id);
});
it("never replaces a higher cached revision with an older server row", async () => {
  const id = crypto.randomUUID(),
    day = new Date().toISOString().slice(0, 10);
  await changeMemberState(user, (s) => ({
    ...s,
    records: { food_logs: [{ id, log_date: day, revision: 2, calories: 600 }] },
  }));
  await cacheMemberRecords(
    user,
    "food_logs",
    [{ id, log_date: day, revision: 1, calories: 400 }],
    await beginMemberRead(user),
  );
  expect((await readMemberState(user)).records.food_logs?.[0]).toMatchObject({
    revision: 2,
    calories: 600,
  });
});
it("rejects snapshots started before an acknowledged delete or newly accepted record", async () => {
  const id = crypto.randomUUID(),
    old = await beginMemberRead(user);
  await queueMemberWrites(user, [{ entity: "water_logs", op: "put", record: { id, ml: 250 } }]);
  const first = (await readMemberState(user)).queue[0]!;
  backend([
    {
      id: first.id,
      status: "applied",
      record: { id, member_id: user, ml: 250, revision: 1 },
      revision: 1,
    },
  ]);
  await syncMemberEntries(user);
  expect(await cacheMemberRecords(user, "water_logs", [], old)).toBe(false);
  expect((await readMemberState(user)).records.water_logs).toHaveLength(1);
  const beforeDelete = await beginMemberRead(user);
  await queueMemberWrites(user, [{ entity: "water_logs", op: "delete", record: { id, ml: 250 } }]);
  const deletion = (await readMemberState(user)).queue[0]!;
  backend([{ id: deletion.id, status: "applied", record: null, revision: 2 }]);
  await syncMemberEntries(user);
  expect(
    await cacheMemberRecords(user, "water_logs", [{ id, ml: 250, revision: 1 }], beforeDelete),
  ).toBe(false);
  expect((await readMemberState(user)).records.water_logs).toHaveLength(0);
});
it("queues a meal atomically with stable unique ingredient IDs", async () => {
  await queueMemberWrites(
    user,
    [1, 2, 3].map(() => ({
      entity: "food_logs",
      op: "put",
      record: { id: crypto.randomUUID(), name: "Meal", calories: 100 },
    })),
  );
  const s = await readMemberState(user);
  expect(new Set(s.queue.map((m) => m.group)).size).toBe(1);
  expect(new Set(s.queue.map((m) => m.record_id)).size).toBe(3);
});
it("acknowledges a lost-response retry without retaining duplicate entries", async () => {
  const id = crypto.randomUUID();
  await queueMemberWrites(user, [{ entity: "water_logs", op: "put", record: { id, ml: 250 } }]);
  const m = (await readMemberState(user)).queue[0]!;
  backend([
    {
      id: m.id,
      status: "already_applied",
      record: { id, member_id: user, ml: 250, revision: 1 },
      revision: 1,
    },
  ]);
  await syncMemberEntries(user);
  const s = await readMemberState(user);
  expect(s.queue).toHaveLength(0);
  expect(s.records.water_logs).toHaveLength(1);
});
it("retains permanent failures without silently reporting synchronization", async () => {
  await queueMemberWrites(user, [
    { entity: "water_logs", op: "put", record: { id: crypto.randomUUID(), ml: 250 } },
  ]);
  backend(null, { code: "42501", message: "Membership paused" });
  await syncMemberEntries(user);
  expect((await readMemberState(user)).queue[0]).toMatchObject({
    status: "rejected",
    error: "Membership paused",
  });
});
it("exposes conflicts and submits a deliberate new revision", async () => {
  const id = crypto.randomUUID();
  await queueMemberWrites(user, [{ entity: "water_logs", op: "put", record: { id, ml: 250 } }]);
  const m = (await readMemberState(user)).queue[0]!;
  backend([
    {
      id: m.id,
      status: "conflict",
      record: { id, member_id: user, ml: 500, revision: 2 },
      revision: 2,
    },
  ]);
  await syncMemberEntries(user);
  await resolveMemberConflict(user, m.id, "local");
  const retry = (await readMemberState(user)).queue[0]!;
  expect(retry.id).not.toBe(m.id);
  expect(retry.base_revision).toBe(2);
});
it("rejects a stale conflict review without clearing newer device changes", async () => {
  const id = crypto.randomUUID();
  await queueMemberWrites(user, [{ entity: "water_logs", op: "put", record: { id, ml: 250 } }]);
  await changeMemberState(user, (s) => ({
    ...s,
    queue: s.queue.map((m) => ({
      ...m,
      status: "conflict",
      server_revision: 2,
      server: { id, ml: 500 },
    })),
  }));
  const reviewed = (await readMemberState(user)).queue;
  await changeMemberState(user, (s) => ({
    ...s,
    queue: s.queue.map((m) => ({ ...m, payload: { ...m.payload, ml: 750 } })),
  }));
  await expect(resolveMemberConflict(user, reviewed[0]!.id, "server", reviewed)).rejects.toThrow(
    "conflict changed",
  );
  expect((await readMemberState(user)).queue[0]!.payload["ml"]).toBe(750);
});
it("never sends the previous member's queue through a new session", async () => {
  await queueMemberWrites(user, [
    { entity: "water_logs", op: "put", record: { id: crypto.randomUUID(), ml: 250 } },
  ]);
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: crypto.randomUUID() } } },
    error: null,
  } as never);
  await syncMemberEntries(user);
  expect(supabase.rpc).not.toHaveBeenCalled();
  expect((await readMemberState(user)).queue).toHaveLength(1);
});
