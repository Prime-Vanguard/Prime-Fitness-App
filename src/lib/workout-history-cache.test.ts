import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { changeMemberState } from "./member-store";
import {
  historyEntrySchema,
  readOfflineHistoryPage,
  readOfflineHistoryEntry,
  workoutHistorySnapshotSchema,
  readWorkoutHistorySnapshot,
} from "./workout-history-cache";

function entry(memberId: string, index = 0) {
  return historyEntrySchema.parse({
    session: {
      id: `session-${index}`,
      member_id: memberId,
      title: index === 0 ? "Lift 100%_" : `Workout ${index}`,
      started_at: `2026-11-16T${String(index % 24).padStart(2, "0")}:00:00Z`,
      finished_at: "2026-11-17T00:00:00Z",
      activity_date: index === 0 ? "2026-11-15" : null,
      origin: "native",
      time_precision: "timestamp",
      set_logs: [{ count: 1 }],
    },
    slots: [
      {
        id: `slot-${index}`,
        member_id: memberId,
        session_id: `session-${index}`,
        exercise_id: "exercise",
        slot_key: "frozen-slot",
        snapshot: { name_en: "Frozen name", name_ar: null, muscle: "quads", equipment: null },
      },
    ],
    sets: [
      {
        id: `set-${index}`,
        member_id: memberId,
        session_id: `session-${index}`,
        exercise_id: "exercise",
        workout_exercise_id: `slot-${index}`,
        created_at: "2026-11-16T00:00:00Z",
        set_number: 1,
        reps: 8,
        weight_kg: 25,
        rpe: null,
      },
    ],
  });
}
async function store(memberId: string, entries = [entry(memberId)]) {
  const snapshot = workoutHistorySnapshotSchema.parse({
    version: 1,
    memberId,
    preparedAt: new Date().toISOString(),
    from: "2026-11-01",
    to: "2026-11-30",
    entries,
  });
  await changeMemberState(memberId, (state) => ({
    ...state,
    references: { workoutHistory: snapshot },
  }));
}
it("keeps undownloaded history distinct from a completed empty download", async () => {
  const memberId = crypto.randomUUID();
  await expect(readOfflineHistoryPage(memberId, {})).rejects.toThrow("Download workout history");
  await store(memberId, []);
  expect((await readOfflineHistoryPage(memberId, {})).rows).toEqual([]);
  await expect(readOfflineHistoryEntry(memberId, "not-downloaded")).rejects.toThrow(
    "Download workout history",
  );
});
it("uses literal title matching, Cairo dates and stable twenty-row pagination", async () => {
  const memberId = crypto.randomUUID();
  await store(
    memberId,
    Array.from({ length: 25 }, (_, index) => entry(memberId, index)),
  );
  expect(
    (
      await readOfflineHistoryPage(memberId, { q: "100%_", from: "2026-11-15", to: "2026-11-15" })
    ).rows.map((row) => row.id),
  ).toEqual(["session-0"]);
  const first = await readOfflineHistoryPage(memberId, {});
  const second = await readOfflineHistoryPage(memberId, { page: 1 });
  expect(first.rows).toHaveLength(20);
  expect(second.rows).toHaveLength(5);
  expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(25);
});
it("restores set metadata and frozen labels", async () => {
  const memberId = crypto.randomUUID();
  await store(memberId);
  const saved = await readOfflineHistoryEntry(memberId, "session-0");
  expect(saved.slots[0]?.snapshot).toMatchObject({ name_en: "Frozen name" });
  expect(saved.sets[0]).toMatchObject({ reps: 8, weight_kg: 25, logging_mode: "weighted_reps" });
});
it("marks uncovered date filters without confusing them with a known empty range", async () => {
  const memberId = crypto.randomUUID();
  await store(memberId, []);
  const unknown = await readOfflineHistoryPage(memberId, { from: "2020-01-01", to: "2020-01-31" });
  expect(unknown.rows).toEqual([]);
  expect(unknown.hasIncompleteDateCoverage).toBe(true);
  const known = await readOfflineHistoryPage(memberId, { from: "2026-11-01", to: "2026-11-02" });
  expect(known.hasIncompleteDateCoverage).toBe(false);
});
it("rejects foreign records, incomplete sets and unsupported versions", async () => {
  const memberId = crypto.randomUUID();
  const foreign = entry(memberId);
  foreign.sets[0]!.member_id = "other";
  await store(memberId, [foreign]);
  await expect(readWorkoutHistorySnapshot(memberId)).rejects.toThrow();
  const incomplete = entry(memberId);
  incomplete.sets = [];
  await store(memberId, [incomplete]);
  await expect(readWorkoutHistorySnapshot(memberId)).rejects.toThrow();
  await changeMemberState(memberId, (state) => ({
    ...state,
    references: { workoutHistory: { version: 99 } },
  }));
  await expect(readWorkoutHistorySnapshot(memberId)).rejects.toThrow();
});
