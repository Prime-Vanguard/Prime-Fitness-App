import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { changeMemberState, queueMemberWrites, readMemberState } from "./member-store";

const scope = (user: string) => `${import.meta.env["VITE_SUPABASE_URL"]}:${user}`;
const water = (id: string, ml: number) => ({ id, ml, log_date: "2026-11-20", revision: 1 });
afterEach(() => vi.restoreAllMocks());

// Runs first: the module has not opened the database yet, so this exercises the v1 upgrade.
it("moves a version 1 member value into per-record storage without losing queued writes", async () => {
  const user = crypto.randomUUID();
  const queued = {
    id: "m1",
    record_id: "w2",
    entity: "water_logs",
    op: "put",
    payload: water("w2", 300),
    base_revision: 0,
    group: "g1",
    status: "queued",
  };
  const legacy = {
    version: 1,
    cacheEpochs: { water_logs: 3 },
    records: { water_logs: [water("w1", 250), water("w2", 300)], saved_meals: [] },
    queue: [queued],
    references: { foodWindow: { from: "2026-11-01", to: "2026-11-20" } },
    lastSync: "2026-11-20T10:00:00.000Z",
  };
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.open("prime-fitness-member-data", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("members").put(legacy, scope(user));
    r.onsuccess = () => {
      r.result.close();
      resolve();
    };
    r.onerror = () => reject(r.error);
  });

  expect(await readMemberState(user)).toEqual(legacy);
});

it("stores records in order and rewrites only the record a write touches", async () => {
  const user = crypto.randomUUID();
  await changeMemberState(user, (s) => ({
    ...s,
    records: { water_logs: [water("a", 1), water("b", 2), water("c", 3)] },
    references: { big: { rows: Array.from({ length: 50 }, (_, i) => i) } },
  }));
  expect((await readMemberState(user)).records.water_logs?.map((r) => r.id)).toEqual([
    "a",
    "b",
    "c",
  ]);

  const put = vi.spyOn(IDBObjectStore.prototype, "put");
  await queueMemberWrites(user, [
    { entity: "water_logs", op: "put", record: { ...water("d", 4), revision: 0 } },
  ]);
  const stores = put.mock.contexts.map((store) => (store as IDBObjectStore).name);
  expect(stores.filter((name) => name === "member_records")).toHaveLength(1);
  expect(stores).not.toContain("member_references");

  const state = await readMemberState(user);
  expect(state.records.water_logs?.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  expect(state.queue).toHaveLength(1);
});
