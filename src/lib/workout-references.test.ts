import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const backend = vi.hoisted(() => ({
  rows: [] as unknown[],
  calls: [] as Record<string, string>[],
  error: false,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const filters: Record<string, string> = {};
      backend.calls.push(filters);
      const q = {
        select: () => q,
        neq: () => q,
        not: () => q,
        order: () => q,
        limit: () => q,
        eq: (key: string, value: string) => {
          filters[key] = value;
          return q;
        },
        abortSignal: async () => ({
          data: backend.rows,
          error: backend.error ? new Error("Connection interrupted") : null,
        }),
      };
      return q;
    },
  },
}));
import {
  cachedPreviousPerformance,
  loadPreviousPerformance,
  readRestPreference,
  saveRestPreference,
  type PreviousContext,
} from "./workout-references";
let context: PreviousContext;
beforeEach(() => {
  backend.rows = [];
  backend.calls = [];
  backend.error = false;
  context = {
    member: crypto.randomUUID(),
    session: crypto.randomUUID(),
    exercise: crypto.randomUUID(),
    slot: "version:slot",
    side: "bilateral",
    mode: "weighted_reps",
    convention: "external_total",
  };
});
afterEach(() => vi.restoreAllMocks());
it("retrieves the exact slot and caches a canonical, member-scoped offline reference", async () => {
  backend.rows = [
    {
      id: crypto.randomUUID(),
      session_id: crypto.randomUUID(),
      exercise_id: context.exercise,
      reps: 8,
      duration_seconds: null,
      weight_kg: 60,
      created_at: "2026-10-20T10:00:00Z",
      slot_key: context.slot,
      workout_sessions: { finished_at: "2026-10-20T11:00:00Z", origin: "native" },
    },
  ];
  expect(await loadPreviousPerformance(context)).toMatchObject({
    weight_kg: 60,
    cached: false,
    match: "slot",
  });
  expect(backend.calls[0]).toMatchObject({
    slot_key: context.slot,
    side: "bilateral",
    logging_mode: "weighted_reps",
    set_role: "working",
  });
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  expect(await loadPreviousPerformance(context)).toMatchObject({ weight_kg: 60, cached: true });
  expect(await cachedPreviousPerformance({ ...context, member: crypto.randomUUID() })).toBeNull();
  expect(await cachedPreviousPerformance({ ...context, side: "left" })).toBeNull();
  expect(await cachedPreviousPerformance(context, Date.now() + 8 * 86400000)).toBeNull();
});
it("falls back to a cached reference on flaky connections and invalidates it after an empty successful refresh", async () => {
  backend.rows = [
    {
      id: crypto.randomUUID(),
      session_id: crypto.randomUUID(),
      exercise_id: context.exercise,
      reps: null,
      duration_seconds: 30,
      weight_kg: null,
      created_at: "2026-10-20T10:00:00Z",
      slot_key: context.slot,
      workout_sessions: { finished_at: "2026-10-20T11:00:00Z", origin: "import" },
    },
  ];
  await loadPreviousPerformance(context);
  backend.error = true;
  expect(await loadPreviousPerformance(context)).toMatchObject({
    cached: true,
    workout_sessions: { origin: "import" },
  });
  backend.error = false;
  backend.rows = [];
  expect(await loadPreviousPerformance(context)).toBeNull();
  expect(await cachedPreviousPerformance(context)).toBeNull();
});
it("keeps custom rest settings separate by member and exercise slot", async () => {
  await saveRestPreference(context.member, "bench:first", 141);
  await saveRestPreference(context.member, "bench:second", 60);
  expect(await readRestPreference(context.member, "bench:first")).toBe(141);
  expect(await readRestPreference(context.member, "bench:second")).toBe(60);
  expect(await readRestPreference(crypto.randomUUID(), "bench:first")).toBe(90);
  await expect(saveRestPreference(context.member, "bench:first", 0)).rejects.toThrow();
  expect(await readRestPreference(context.member, "bench:first")).toBe(141);
});

it("returns the previous session's working sets in logged order for the Prev column", async () => {
  const last = crypto.randomUUID(),
    older = crypto.randomUUID();
  const row = (session: string, weight: number, at: string) => ({
    id: crypto.randomUUID(),
    session_id: session,
    exercise_id: context.exercise,
    reps: 8,
    duration_seconds: null,
    weight_kg: weight,
    created_at: at,
    slot_key: context.slot,
    workout_sessions: { finished_at: "2026-10-20T11:00:00Z", origin: "native" },
  });
  // Newest first, as the query orders them.
  backend.rows = [
    row(last, 65, "2026-10-20T10:10:00Z"),
    row(last, 62.5, "2026-10-20T10:05:00Z"),
    row(last, 60, "2026-10-20T10:00:00Z"),
    row(older, 55, "2026-10-13T10:00:00Z"),
  ];
  const result = await loadPreviousPerformance(context);
  expect(result?.weight_kg).toBe(65);
  expect(result?.sets.map((set) => set.weight_kg)).toEqual([60, 62.5, 65]);
});
