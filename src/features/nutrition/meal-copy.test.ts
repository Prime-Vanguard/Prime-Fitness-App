import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn() } },
}));
import { supabase } from "@/integrations/supabase/client";
import { readMemberState } from "@/lib/member-store";
import { activityDay } from "@/lib/dates";
import { prepareMealCopy, commitMealCopy, parseMealCopy, mergeMealCopyRecovery } from "./meal-copy";
import { servingMeasure } from "./serving-measure";
let user: string;
const food = { name: "Oats", calories: 200, protein_g: 10, carbs_g: 30, fat_g: 5 };
beforeEach(() => {
  vi.resetAllMocks();
  user = crypto.randomUUID();
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: null },
    error: null,
  } as never);
});
it("copies scaled canonical values with new stable IDs and reconciles a lost native response", async () => {
  const saved = new Map<string, unknown>();
  let fail = true;
  const upsert = vi.fn(async (rows: { id: string }[], options: unknown) => {
    expect(options).toEqual({ onConflict: "id", ignoreDuplicates: true });
    for (const row of rows) saved.set(row.id, row);
    return { error: fail ? new Error("Lost response") : null };
  });
  vi.mocked(supabase.from).mockReturnValue({ upsert } as never);
  const copy = await prepareMealCopy(
    user,
    activityDay(),
    "breakfast",
    [food, { ...food, name: "Milk" }],
    "0.5",
    false,
  );
  expect(copy.items.map((row) => row.calories)).toEqual([100, 100]);
  expect(copy.items[0]!.id).not.toBe(copy.items[1]!.id);
  await expect(commitMealCopy(user, copy)).rejects.toThrow("Lost response");
  expect(parseMealCopy((await readMemberState(user)).references["mealCopy"], user)).toEqual(copy);
  fail = false;
  await commitMealCopy(user, copy);
  expect(saved.size).toBe(2);
  expect(upsert.mock.calls[1]![0]).toEqual(upsert.mock.calls[0]![0]);
  expect((await readMemberState(user)).references["mealCopy"]).toBeNull();
});
it("queues one atomic meal and clears its intent despite simultaneous confirmations", async () => {
  const copy = await prepareMealCopy(
    user,
    activityDay(),
    "lunch",
    [food, { ...food, name: "Milk" }],
    "1",
    true,
  );
  const outcomes = await Promise.allSettled([
    commitMealCopy(user, copy),
    commitMealCopy(user, copy),
  ]);
  expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const state = await readMemberState(user);
  expect(state.records.food_logs).toHaveLength(2);
  expect(state.queue).toHaveLength(2);
  expect(new Set(state.queue.map((row) => row.group)).size).toBe(1);
  expect(state.references["mealCopy"]).toBeNull();
});
it("rejects changed snapshots, cross-member copies and invalid portions without replacing recovery", async () => {
  const copy = await prepareMealCopy(user, activityDay(), "lunch", [food], "1", false);
  await expect(
    commitMealCopy(user, { ...copy, items: [{ ...copy.items[0]!, calories: 999 }] }),
  ).rejects.toThrow("reviewed copy changed");
  expect(() => parseMealCopy(copy, crypto.randomUUID())).toThrow("ownership");
  await expect(
    prepareMealCopy(user, activityDay(), "breakfast", [food], "0", false),
  ).rejects.toThrow();
  await expect(
    prepareMealCopy(user, activityDay(), "breakfast", [food], "1", false),
  ).rejects.toThrow("Resolve the saved meal copy");
  expect(parseMealCopy((await readMemberState(user)).references["mealCopy"], user)?.id).toBe(
    copy.id,
  );
});
it("only converts explicit metric servings, including Arabic decimals", () => {
  expect(servingMeasure("100 g")).toEqual({ amount: 100, unit: "g" });
  expect(servingMeasure("٢٥٠ مل")).toEqual({ amount: 250, unit: "ml" });
  expect(servingMeasure("١٢٫٥ جم")).toEqual({ amount: 12.5, unit: "g" });
  for (const label of ["1 cup", "1 scoop (30g)", "per 100g", "0 g", "1 oz", ""])
    expect(servingMeasure(label)).toBeNull();
});
it("restores a saved copy without replacing a different request or requeueing completed identities", async () => {
  const copy = await prepareMealCopy(user, activityDay(), "lunch", [food], "1", true);
  const refs = { mealCopy: copy };
  expect(mergeMealCopyRecovery({}, refs, user)).toEqual(refs);
  expect(mergeMealCopyRecovery({}, refs, user, new Set(copy.items.map((row) => row.id)))).toEqual(
    {},
  );
  expect(() =>
    mergeMealCopyRecovery({ mealCopy: { ...copy, id: crypto.randomUUID() } }, refs, user),
  ).toThrow("Resolve the current meal copy");
  expect(() => mergeMealCopyRecovery({}, refs, crypto.randomUUID())).toThrow("ownership");
});
