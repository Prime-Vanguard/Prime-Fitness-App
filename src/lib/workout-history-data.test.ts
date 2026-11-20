import "fake-indexeddb/auto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));
vi.mock("./offline-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./offline-access")>()),
  readOfflineIdentity: vi.fn(),
}));
import { supabase } from "@/integrations/supabase/client";
import { readOfflineIdentity } from "./offline-access";
import { prepareWorkoutHistory, loadWorkoutHistoryDetails } from "./workout-history-data";
import { changeMemberState, readMemberState } from "./member-store";
import { activityDay } from "./dates";
import { workoutHistorySnapshotSchema, readWorkoutHistorySnapshot } from "./workout-history-cache";
let memberId: string;
let failedTable: string | undefined;
let requestError: { message: string; code: string };
let foreignSets: boolean;
let mismatchCount: boolean;
let switchIdentity: boolean;
let sessionPrefix: string;
let historyDate: string;
const now = new Date().toISOString();
beforeEach(() => {
  vi.resetAllMocks();
  memberId = crypto.randomUUID();
  failedTable = undefined;
  foreignSets = false;
  mismatchCount = false;
  switchIdentity = false;
  sessionPrefix = "session";
  historyDate = activityDay();
  requestError = { message: "Download interrupted", code: "" };
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.mocked(readOfflineIdentity).mockReturnValue({ id: memberId });
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: memberId } },
    error: null,
  } as never);
  vi.mocked(supabase.from).mockImplementation((tableName: string) => {
    let offset = 0;
    let dateFilter: string | undefined;
    let sessionIds: string[] | undefined;
    let selectedSession: string | undefined;
    const query = {
      select: () => query,
      not: () => query,
      or: (filter: string) => {
        dateFilter = filter;
        return query;
      },
      order: () => query,
      abortSignal: () => query,
      maybeSingle: () => query,
      eq: (column: string, value: string) => {
        if (column === "session_id") selectedSession = value;
        return query;
      },
      in: (_column: string, values: string[]) => {
        sessionIds = values;
        return query;
      },
      range: (first: number) => {
        offset = first;
        return query;
      },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve()
          .then(() => {
            if (tableName === "profiles") return { data: { access_active: true }, error: null };
            if (tableName === failedTable) return { data: null, error: requestError };
            const from = dateFilter?.match(/activity_date.gte.([0-9-]+)/)?.[1];
            const to = dateFilter?.match(/activity_date.lte.([0-9-]+)/)?.[1];
            const rows = [0, 1]
              .map((index) => {
                const sessionId = `${sessionPrefix}-${index}`;
                if (tableName === "workout_sessions")
                  return {
                    id: sessionId,
                    member_id: memberId,
                    title: "Recent workout",
                    started_at: now,
                    finished_at: now,
                    activity_date: historyDate,
                    origin: "native",
                    time_precision: "timestamp",
                    set_logs: [{ count: mismatchCount ? 2 : 1 }],
                  };
                if (tableName === "workout_exercises")
                  return {
                    id: `${sessionPrefix}-slot-${index}`,
                    member_id: memberId,
                    session_id: sessionId,
                    exercise_id: "exercise",
                    slot_key: "frozen",
                    snapshot: { name_en: "Frozen exercise" },
                  };
                return {
                  id: `${sessionPrefix}-set-${index}`,
                  member_id: foreignSets ? "other" : memberId,
                  session_id: sessionId,
                  exercise_id: "exercise",
                  workout_exercise_id: `${sessionPrefix}-slot-${index}`,
                  created_at: now,
                  set_number: 1,
                  reps: 8,
                  weight_kg: 50,
                  rpe: null,
                };
              })
              .filter(
                (row) =>
                  (!("activity_date" in row) ||
                    ((!from || String(row.activity_date) >= from) &&
                      (!to || String(row.activity_date) <= to))) &&
                  (!sessionIds ||
                    ("session_id" in row && sessionIds.includes(String(row.session_id)))) &&
                  (!selectedSession || ("session_id" in row && row.session_id === selectedSession)),
              );
            if (switchIdentity && tableName === "set_logs")
              vi.mocked(readOfflineIdentity).mockReturnValue({ id: "other" });
            // Simulate a server row cap lower than the requested 500 rows.
            return { data: rows.slice(offset, offset + 1), error: null };
          })
          .then(resolve, reject),
    };
    return query as never;
  });
});
afterEach(() => vi.restoreAllMocks());
it("downloads every capped page and atomically records complete history", async () => {
  await changeMemberState(memberId, (state) => ({
    ...state,
    references: { retained: "private draft reference" },
  }));
  await prepareWorkoutHistory(memberId);
  const saved = await readMemberState(memberId);
  expect(saved.references["workoutHistoryManifest"]).toMatchObject({
    sessionCount: 2,
    setCount: 2,
  });
  expect(saved.references["retained"]).toBe("private draft reference");
});
it("retains the previous download on a failed detail request", async () => {
  await prepareWorkoutHistory(memberId);
  const original = (await readMemberState(memberId)).references["workoutHistory"];
  failedTable = "set_logs";
  await expect(prepareWorkoutHistory(memberId)).rejects.toThrow("interrupted");
  expect((await readMemberState(memberId)).references["workoutHistory"]).toEqual(original);
});
it("recovers a corrupt previous cache without retaining foreign entries", async () => {
  await prepareWorkoutHistory(memberId);
  const corrupted = workoutHistorySnapshotSchema.parse(
    (await readMemberState(memberId)).references["workoutHistory"],
  );
  corrupted.entries[0]!.session.member_id = "other";
  corrupted.entries[0]!.session.activity_date = "2000-01-01";
  await changeMemberState(memberId, (state) => ({
    ...state,
    references: { ...state.references, workoutHistory: corrupted },
  }));
  await prepareWorkoutHistory(memberId);
  const recovered = await readWorkoutHistorySnapshot(memberId);
  expect(recovered.entries).toHaveLength(2);
  expect(recovered.entries.every((entry) => entry.session.member_id === memberId)).toBe(true);
});
it("rejects foreign records, set-count mismatches and mid-download account switches", async () => {
  foreignSets = true;
  await expect(prepareWorkoutHistory(memberId)).rejects.toThrow();
  foreignSets = false;
  mismatchCount = true;
  await expect(prepareWorkoutHistory(memberId)).rejects.toThrow();
  mismatchCount = false;
  switchIdentity = true;
  await expect(prepareWorkoutHistory(memberId)).rejects.toThrow("same account");
  expect((await readMemberState(memberId)).references["workoutHistory"]).toBeUndefined();
});
it("uses downloaded details for fetch failures but never for permission denials", async () => {
  await prepareWorkoutHistory(memberId);
  failedTable = "set_logs";
  requestError = { code: "", message: "TypeError: Failed to fetch" };
  const cached = await loadWorkoutHistoryDetails(
    memberId,
    "session-0",
    new AbortController().signal,
  );
  expect(cached.sets).toHaveLength(1);
  requestError = { code: "42501", message: "permission denied" };
  await expect(
    loadWorkoutHistoryDetails(memberId, "session-0", new AbortController().signal),
  ).rejects.toThrow("permission denied");
});

it("adds older ranges, preserves recent entries and accurately retains coverage gaps", async () => {
  await prepareWorkoutHistory(memberId);
  sessionPrefix = "archive";
  historyDate = "2020-01-10";
  await prepareWorkoutHistory(memberId, { from: "2020-01-01", to: "2020-01-31" });
  const snapshot = await readWorkoutHistorySnapshot(memberId);
  expect(snapshot.entries).toHaveLength(4);
  expect(snapshot.coverage).toHaveLength(2);
  expect(snapshot.coverage[0]).toEqual({ from: "2020-01-01", to: "2020-01-31" });
  expect(snapshot.entries.some((entry) => entry.session.id === "session-0")).toBe(true);
  expect(snapshot.entries.some((entry) => entry.session.id === "archive-0")).toBe(true);
});
it("rejects reversed ranges before authentication or download", async () => {
  await expect(
    prepareWorkoutHistory(memberId, { from: "2020-03-01", to: "2020-01-01" }),
  ).rejects.toThrow();
  expect(supabase.auth.getUser).not.toHaveBeenCalled();
});
