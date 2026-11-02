import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn() } },
}));
import { supabase } from "@/integrations/supabase/client";
import { changeMemberState, readMemberState } from "./member-store";
import {
  waterEntry,
  waterAmount,
  saveWaterEdit,
  deleteWaterEntry,
  waterUndoEntries,
  restoreWaterEntry,
  mergeWaterRecovery,
  type WaterEntry,
} from "./water-entries";
let user: string, row: WaterEntry;
beforeEach(async () => {
  vi.resetAllMocks();
  user = crypto.randomUUID();
  row = { id: crypto.randomUUID(), member_id: user, log_date: "2026-10-20", revision: 1, ml: 250 };
  await changeMemberState(user, (state) => ({ ...state, records: { water_logs: [{ ...row }] } }));
});
it("validates canonical whole millilitres and ownership", () => {
  expect(waterAmount("٧٥٠")).toBe(750);
  for (const amount of ["", 0, 1.5, -1, 10001, Infinity])
    expect(() => waterAmount(amount)).toThrow();
  expect(() => waterEntry({ ...row, ml: 0 }, user)).toThrow();
  expect(() => waterEntry(row, crypto.randomUUID())).toThrow("another member");
});
it("preserves water identity through edit/delete/Undo and rejects a stale editor", async () => {
  await saveWaterEdit(user, row, "750", true, false);
  await expect(saveWaterEdit(user, row, "900", true, false)).rejects.toThrow();
  let current = (await readMemberState(user)).records.water_logs![0]!;
  expect(current).toMatchObject({ id: row.id, ml: 750, log_date: row.log_date, revision: 2 });
  await deleteWaterEntry(user, waterEntry(current, user), true, false);
  const undo = waterUndoEntries((await readMemberState(user)).references)[0]!;
  expect((await readMemberState(user)).records.water_logs).toEqual([]);
  await restoreWaterEntry(user, undo);
  const restored = await readMemberState(user);
  current = restored.records.water_logs![0]!;
  expect(current).toMatchObject({ id: row.id, ml: 750, revision: 4 });
  expect(waterUndoEntries(restored.references)).toEqual([]);
  expect(restored.queue.map((m) => [m.op, m.base_revision, m.record_id])).toEqual([
    ["put", 1, row.id],
    ["delete", 2, row.id],
    ["put", 3, row.id],
  ]);
});
it("retains recovery when a queued restore is rejected by device storage", async () => {
  await deleteWaterEntry(user, row, true, false);
  const before = await readMemberState(user),
    undo = waterUndoEntries(before.references)[0]!;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
    throw new DOMException("Full", "QuotaExceededError");
  });
  await expect(restoreWaterEntry(user, undo)).rejects.toThrow();
  vi.restoreAllMocks();
  expect(await readMemberState(user)).toEqual(before);
});
it("guards native water edits by member, ID and revision and refuses zero-row success", async () => {
  const filters: unknown[][] = [];
  const query = {
    update: vi.fn().mockReturnThis(),
    eq: (...args: unknown[]) => {
      filters.push(args);
      return query;
    },
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  vi.mocked(supabase.from).mockReturnValue(query as never);
  await expect(saveWaterEdit(user, row, 500, false, false)).rejects.toThrow("changed");
  expect(filters).toEqual([
    ["id", row.id],
    ["member_id", user],
    ["revision", 1],
  ]);
});
it("merges validated water recovery without replacing pending edits or food recovery", async () => {
  await deleteWaterEntry(user, row, true, false);
  const source = (await readMemberState(user)).references,
    current = { nutritionUndo: [], targets: "current" };
  expect(mergeWaterRecovery(current, source, user, new Set([row.id]))).toEqual({
    ...current,
    waterUndo: [],
  });
  expect(waterUndoEntries(mergeWaterRecovery(current, source, user, new Set()))).toHaveLength(1);
  expect(() => mergeWaterRecovery({}, source, crypto.randomUUID(), new Set())).toThrow();
});
