import "fake-indexeddb/auto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), auth: { getSession: vi.fn() } },
}));
import { supabase } from "@/integrations/supabase/client";
import { changeMemberState, readMemberState, syncMemberEntries } from "./member-store";
import {
  foodEntry,
  foodUndoEntries,
  saveFoodEdit,
  deleteFoodEntry,
  restoreFoodEntry,
  finishFoodDeletion,
  type FoodEntry,
  mergeFoodRecovery,
} from "./nutrition-entries";
let user: string, record: FoodEntry;
beforeEach(async () => {
  vi.resetAllMocks();
  user = crypto.randomUUID();
  record = {
    id: crypto.randomUUID(),
    member_id: user,
    log_date: "2026-10-20",
    meal: "breakfast",
    name: "Oats",
    calories: 200,
    protein_g: 10,
    carbs_g: 30,
    fat_g: 5,
    revision: 1,
  };
  await changeMemberState(user, (s) => ({ ...s, records: { food_logs: [{ ...record }] } }));
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: user } } },
    error: null,
  } as never);
});
afterEach(() => vi.restoreAllMocks());
function native(responses: unknown[]) {
  const calls: { action: string; payload?: unknown; filters: unknown[][] }[] = [];
  vi.mocked(supabase.from).mockImplementation(() => {
    const result = responses.shift(),
      call = { action: "read", filters: [] as unknown[][] } as (typeof calls)[number];
    calls.push(call);
    const query = {
      eq: (...args: unknown[]) => {
        call.filters.push(args);
        return query;
      },
      select: () => query,
      update: (payload: unknown) => {
        call.action = "update";
        call.payload = payload;
        return query;
      },
      delete: () => {
        call.action = "delete";
        return query;
      },
      insert: (payload: unknown) => {
        call.action = "insert";
        call.payload = payload;
        return query;
      },
      maybeSingle: () => Promise.resolve(result),
      single: () => Promise.resolve(result),
      then: (resolve: (value: unknown) => void) => Promise.resolve(result).then(resolve),
    };
    return query as never;
  });
  return calls;
}
it("edits the same queued identity and activity date, rejecting a stale local editor", async () => {
  await saveFoodEdit(user, record, { ...record, calories: 350 }, "lunch", true, false);
  let state = await readMemberState(user);
  expect(state.records.food_logs).toHaveLength(1);
  expect(state.records.food_logs![0]).toMatchObject({
    id: record.id,
    log_date: record.log_date,
    meal: "lunch",
    calories: 350,
    revision: 2,
  });
  await expect(
    saveFoodEdit(user, record, { ...record, calories: 500 }, "dinner", true, false),
  ).rejects.toThrow("another tab");
  state = await readMemberState(user);
  expect(state.queue).toHaveLength(1);
  expect(state.records.food_logs![0]!["calories"]).toBe(350);
});
it("queues delete/recovery atomically and permits exactly one concurrent Undo with the same ID", async () => {
  await deleteFoodEntry(user, record, true, false);
  let state = await readMemberState(user);
  expect(state.records.food_logs).toHaveLength(0);
  const undo = foodUndoEntries(state.references)[0]!;
  const outcomes = await Promise.allSettled([
    restoreFoodEntry(user, undo),
    restoreFoodEntry(user, undo),
  ]);
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  state = await readMemberState(user);
  expect(state.queue.map((m) => m.base_revision)).toEqual([1, 2]);
  expect(state.records.food_logs).toHaveLength(1);
  expect(state.records.food_logs![0]!.id).toBe(record.id);
  expect(foodUndoEntries(state.references)).toHaveLength(0);
});
it("restores against the tombstone revision after the server acknowledges deletion", async () => {
  await deleteFoodEntry(user, record, true, false);
  const state = await readMemberState(user),
    mutation = state.queue[0]!,
    undo = foodUndoEntries(state.references)[0]!;
  vi.mocked(supabase.rpc).mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        data: [{ id: mutation.id, status: "applied", record: null, revision: 2 }],
        error: null,
      }),
  } as never);
  await syncMemberEntries(user);
  expect((await readMemberState(user)).queue).toHaveLength(0);
  await restoreFoodEntry(user, undo);
  const restored = await readMemberState(user);
  expect(restored.queue[0]!.base_revision).toBe(2);
  expect(restored.records.food_logs![0]!.revision).toBe(3);
});
it("rolls back both deletion and recovery if IndexedDB cannot commit", async () => {
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
    throw new DOMException("Full", "QuotaExceededError");
  });
  await expect(deleteFoodEntry(user, record, true, false)).rejects.toThrow();
  const state = await readMemberState(user);
  expect(state.records.food_logs).toHaveLength(1);
  expect(state.queue).toHaveLength(0);
  expect(foodUndoEntries(state.references)).toHaveLength(0);
});
it("keeps native recovery when a delete response is lost and confirms it on retry", async () => {
  const calls = native([
    { data: null, error: { message: "Connection lost" } },
    { data: [], error: null },
    { data: null, error: null },
  ]);
  await expect(deleteFoodEntry(user, record, false, false)).rejects.toMatchObject({
    message: "Connection lost",
  });
  const undo = foodUndoEntries((await readMemberState(user)).references)[0]!;
  expect(undo.status).toBe("deleting");
  await finishFoodDeletion(user, undo);
  expect(foodUndoEntries((await readMemberState(user)).references)[0]!.status).toBe("deleted");
  expect(calls[0]!.filters).toContainEqual(["revision", 1]);
  expect(calls[0]!.filters).toContainEqual(["member_id", user]);
});
it("never restores over a different existing native entry", async () => {
  native([{ data: [{ id: record.id }], error: null }]);
  await deleteFoodEntry(user, record, false, false);
  const undo = foodUndoEntries((await readMemberState(user)).references)[0]!;
  native([
    { data: null, error: { code: "23505" } },
    { data: { ...record, calories: 900, revision: 3 }, error: null },
  ]);
  await expect(restoreFoodEntry(user, undo)).rejects.toThrow("different values");
  expect(foodUndoEntries((await readMemberState(user)).references)).toHaveLength(1);
});
it("recognizes an identical native restore retry without adding another entry", async () => {
  native([{ data: [{ id: record.id }], error: null }]);
  await deleteFoodEntry(user, record, false, false);
  const undo = foodUndoEntries((await readMemberState(user)).references)[0]!;
  const calls = native([
    { data: null, error: { code: "23505" } },
    { data: { ...record, revision: 3 }, error: null },
  ]);
  await restoreFoodEntry(user, undo);
  expect(calls).toHaveLength(2);
  expect(foodUndoEntries((await readMemberState(user)).references)).toHaveLength(0);
});
it("preserves draft values when a native conditional edit matches no row", async () => {
  const calls = native([{ data: null, error: null }]);
  await expect(
    saveFoodEdit(user, record, { ...record, calories: 450 }, "dinner", false, false),
  ).rejects.toThrow("changed");
  expect(calls[0]!.filters).toContainEqual(["revision", 1]);
  expect(calls[0]!.payload).toMatchObject({ log_date: record.log_date, calories: 450 });
  expect(record.calories).toBe(200);
});
it("rejects cross-member recovery and does not silently discard malformed recovery data", async () => {
  expect(() => foodEntry(record, crypto.randomUUID())).toThrow();
  expect(() => foodUndoEntries({ nutritionUndo: { unexpected: true } })).toThrow();
  expect((await readMemberState(crypto.randomUUID())).references).toEqual({});
});
it("merges backup recovery without copying caches or replacing current pending edits", () => {
  const first = {
    token: crypto.randomUUID(),
    mode: "queued" as const,
    status: "deleted" as const,
    record,
  };
  const second = {
    ...first,
    token: crypto.randomUUID(),
    record: { ...record, id: crypto.randomUUID() },
  };
  const current = { nutritionUndo: [first], targets: "current" };
  const source = { nutritionUndo: [first, second], targets: "stale", features: { offline: false } };
  expect(mergeFoodRecovery(current, source, user, new Set([second.record.id]))).toEqual(current);
  expect(mergeFoodRecovery(current, source, user, new Set())).toEqual({
    ...current,
    nutritionUndo: [first, second],
  });
  expect(() => mergeFoodRecovery({}, source, crypto.randomUUID(), new Set())).toThrow();
  const ten = Array.from({ length: 10 }, () => ({
    ...first,
    token: crypto.randomUUID(),
    record: { ...record, id: crypto.randomUUID() },
  }));
  expect(() =>
    mergeFoodRecovery({ nutritionUndo: ten }, { nutritionUndo: [first] }, user, new Set()),
  ).toThrow("before importing");
});
