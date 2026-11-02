import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
import { supabase } from "@/integrations/supabase/client";
import { saveNativeMeasurement, type MeasurementWrite } from "./measurement-write";
const owner = crypto.randomUUID();
let payload: MeasurementWrite;
beforeEach(() => {
  vi.resetAllMocks();
  payload = {
    id: crypto.randomUUID(),
    member_id: owner,
    measured_on: "2026-10-30",
    weight_kg: 80,
    waist_cm: null,
    body_fat_pct: null,
  };
});
function mock(results: unknown[]) {
  const filters: unknown[][] = [];
  vi.mocked(supabase.from).mockImplementation(() => {
    const result = results.shift();
    const query = {
      insert: () => query,
      select: () => query,
      eq: (...args: unknown[]) => {
        filters.push(args);
        return query;
      },
      single: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
    };
    return query as never;
  });
  return filters;
}
it("requires the supplied identity in a successful acknowledgement", async () => {
  mock([{ data: null, error: null }]);
  await expect(saveNativeMeasurement(owner, payload)).rejects.toThrow("not confirmed");
});
it("reconciles an identical insertion after a lost acknowledgement", async () => {
  const filters = mock([
    { data: null, error: { code: "23505" } },
    { data: payload, error: null },
  ]);
  await expect(saveNativeMeasurement(owner, payload)).resolves.toBeUndefined();
  expect(filters).toEqual([
    ["id", payload.id],
    ["member_id", owner],
  ]);
});
it("does not overwrite a different existing record during retry", async () => {
  mock([
    { data: null, error: { code: "23505" } },
    { data: { ...payload, weight_kg: 85 }, error: null },
  ]);
  await expect(saveNativeMeasurement(owner, payload)).rejects.toThrow("different measurement");
});
it("rejects foreign ownership, missing measurements and invalid dates before sending", async () => {
  await expect(saveNativeMeasurement(crypto.randomUUID(), payload)).rejects.toThrow();
  await expect(saveNativeMeasurement(owner, { ...payload, weight_kg: null })).rejects.toThrow();
  await expect(
    saveNativeMeasurement(owner, { ...payload, measured_on: "2026-02-30" }),
  ).rejects.toThrow();
  expect(supabase.from).not.toHaveBeenCalled();
});
