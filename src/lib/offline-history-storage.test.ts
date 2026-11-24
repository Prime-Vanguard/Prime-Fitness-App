import { expect, it } from "vitest";
import { emptyMemberState } from "./member-store";
import {
  removableHistoryBytes,
  removeDownloadedHistory,
  signOutHistory,
} from "./offline-history-storage";

it("removes downloaded history but keeps rows with unsent changes", () => {
  const state = {
    ...emptyMemberState(),
    records: {
      water_logs: [
        { id: "synced", log_date: "2026-11-01", ml: 250 },
        { id: "pending", log_date: "2026-11-02", ml: 500 },
      ],
    },
    queue: [{ id: "q", record_id: "pending", entity: "water_logs", op: "upsert" }],
    references: { foodWindow: { from: "2026-10-22", to: "2026-11-20" }, unrelated: true },
  } as never;
  expect(removableHistoryBytes(state)).toBeGreaterThan(0);
  const removed = removeDownloadedHistory(state);
  expect(removed.records.water_logs?.map((row) => row.id)).toEqual(["pending"]);
  // Bumped epochs stop in-flight downloads from refilling the cache.
  expect(removed.cacheEpochs?.water_logs).toBe(1);
  expect(removed.references["foodWindow"]).toBeUndefined();
  expect(removed.references["unrelated"]).toBe(true);
  expect(removed.references["offlineHistoryPaused"]).toBe(true);
});

it("sign-out drops downloaded history without pausing future downloads", () => {
  const state = {
    ...emptyMemberState(),
    records: { water_logs: [{ id: "synced", log_date: "2026-11-01", ml: 250 }] },
    references: { workoutHistory: { entries: [] } },
  } as never;
  const out = signOutHistory(state);
  expect(out.records.water_logs).toEqual([]);
  expect(out.references["workoutHistory"]).toBeUndefined();
  expect(out.references["offlineHistoryPaused"]).toBe(false);
  const paused = { ...emptyMemberState(), references: { offlineHistoryPaused: true } } as never;
  expect(signOutHistory(paused).references["offlineHistoryPaused"]).toBe(true);
});
