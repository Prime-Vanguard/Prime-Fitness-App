import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
const backend = vi.hoisted(() => ({
  rows: [] as { exercise_id: string }[],
  error: false,
  filters: {} as Record<string, unknown>,
  calls: 0,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      backend.calls++;
      const query = {
        select: (value: string) => {
          backend.filters["select"] = value;
          return query;
        },
        eq: (key: string, value: string) => {
          backend.filters[key] = value;
          return query;
        },
        not: (key: string, operator: string, value: unknown) => {
          backend.filters[key] = [operator, value];
          return query;
        },
        order: () => query,
        limit: (value: number) => {
          backend.filters["limit"] = value;
          return query;
        },
        abortSignal: async () => ({
          data: backend.rows,
          error: backend.error ? new Error("Offline") : null,
        }),
      };
      return query;
    },
  },
}));
import { changeMemberState, readMemberState } from "@/lib/member-store";
import {
  decodePickerPreferences,
  loadPickerHistory,
  readPickerPreferences,
  rememberPickerChoices,
  setPickerFavorite,
} from "./exercise-picker-store";
let member: string;
beforeEach(() => {
  member = crypto.randomUUID();
  backend.rows = [];
  backend.error = false;
  backend.filters = {};
  backend.calls = 0;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});
it("saves favorites transactionally and idempotently without overwriting concurrent choices", async () => {
  await Promise.all([setPickerFavorite(member, "a", true), setPickerFavorite(member, "b", true)]);
  await rememberPickerChoices(member, ["b", "a"]);
  await setPickerFavorite(member, "a", true);
  expect(await readPickerPreferences(member)).toEqual({ favorites: ["a", "b"], added: ["b", "a"] });
  expect(await readPickerPreferences(crypto.randomUUID())).toEqual({ favorites: [], added: [] });
  await setPickerFavorite(member, "a", false);
  expect((await readPickerPreferences(member)).favorites).toEqual(["b"]);
});
it("isolates backend projects and preserves unrelated references", async () => {
  await changeMemberState(member, (state) => ({
    ...state,
    references: { targets: { calories: 2100 } },
  }));
  await setPickerFavorite(member, "a", true);
  expect((await readMemberState(member)).references.targets).toEqual({ calories: 2100 });
  const project = import.meta.env["VITE_SUPABASE_URL"];
  vi.stubEnv("VITE_SUPABASE_URL", "https://another-project.test");
  try {
    expect((await readPickerPreferences(member)).favorites).toEqual([]);
  } finally {
    vi.stubEnv("VITE_SUPABASE_URL", project);
  }
});
it("does not report a failed favorite write as saved", async () => {
  await setPickerFavorite(member, "a", true);
  const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
    throw new DOMException("Quota", "QuotaExceededError");
  });
  await expect(setPickerFavorite(member, "b", true)).rejects.toThrow("Quota");
  put.mockRestore();
  expect((await readPickerPreferences(member)).favorites).toEqual(["a"]);
});
it("bounds and validates device metadata", () => {
  expect(
    decodePickerPreferences({
      favorites: ["a", "a", null, 123],
      added: Array.from({ length: 40 }, (_, i) => String(i)),
    }),
  ).toEqual({ favorites: ["a"], added: Array.from({ length: 24 }, (_, i) => String(i)) });
});
it("reads only own completed working performance and caches a bounded offline window", async () => {
  backend.rows = [{ exercise_id: "b" }, { exercise_id: "a" }, { exercise_id: "b" }];
  expect(await loadPickerHistory(member)).toEqual({
    ids: ["b", "a"],
    cached: false,
    unavailable: false,
  });
  expect(backend.filters).toMatchObject({
    member_id: member,
    set_role: "working",
    "workout_sessions.finished_at": ["is", null],
    limit: 200,
  });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  expect(await loadPickerHistory(member)).toEqual({
    ids: ["b", "a"],
    cached: true,
    unavailable: false,
  });
  expect(backend.calls).toBe(1);
  expect((await loadPickerHistory(crypto.randomUUID())).unavailable).toBe(true);
});
it("keeps cached history after network failure but does not present stale cache as current", async () => {
  await changeMemberState(member, (state) => ({
    ...state,
    references: { "exercise-picker-history": { at: Date.now() - 8 * 86400000, ids: ["old"] } },
  }));
  backend.error = true;
  expect(await loadPickerHistory(member)).toEqual({ ids: [], cached: true, unavailable: true });
});
