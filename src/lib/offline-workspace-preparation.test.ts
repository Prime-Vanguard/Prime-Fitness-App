import "fake-indexeddb/auto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("./offline-preparation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./offline-preparation")>()),
  prepareMemberOfflineData: vi.fn(),
}));
vi.mock("./offline-training-preparation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./offline-training-preparation")>()),
  prepareTrainingOfflineData: vi.fn(),
}));
vi.mock("./offline-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./offline-access")>()),
  readOfflineIdentity: vi.fn(),
}));
vi.mock("./workout-history-data", () => ({ prepareWorkoutHistory: vi.fn() }));
import { prepareWorkoutHistory } from "./workout-history-data";
import {
  prepareOfflineWorkspace,
  removeOfflineHistory,
  prepareAdditionalWorkoutHistory,
} from "./offline-workspace-preparation";
import { prepareMemberOfflineData } from "./offline-preparation";
import { prepareTrainingOfflineData } from "./offline-training-preparation";
import { readOfflineIdentity } from "./offline-access";
import {
  beginMemberRead,
  cacheNutritionWindow,
  changeMemberState,
  queueMemberWrites,
  readMemberState,
} from "./member-store";
import { activityDay } from "./dates";
import { offlineHistoryStart } from "./offline-window";
import { changeWorkout } from "./workout-store";
let memberId: string;
beforeEach(() => {
  vi.resetAllMocks();
  memberId = crypto.randomUUID();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.mocked(readOfflineIdentity).mockReturnValue({ id: memberId });
  vi.mocked(prepareWorkoutHistory).mockResolvedValue({} as never);
  vi.mocked(prepareMemberOfflineData).mockResolvedValue({} as never);
  vi.mocked(prepareTrainingOfflineData).mockResolvedValue({} as never);
});
afterEach(() => vi.restoreAllMocks());
it("coalesces requests of the same kind while preserving a manual refresh", async () => {
  const automatic = prepareOfflineWorkspace(memberId);
  expect(prepareOfflineWorkspace(memberId)).toBe(automatic);
  const manual = prepareOfflineWorkspace(memberId, true);
  expect(prepareOfflineWorkspace(memberId, true)).toBe(manual);
  await Promise.all([automatic, manual]);
  expect(prepareMemberOfflineData).toHaveBeenCalledTimes(2);
  expect(prepareTrainingOfflineData).toHaveBeenCalledTimes(2);
});

it("removes history, blocks stale reads, and keeps queued records until a manual download resumes automatic history", async () => {
  const pending = { id: crypto.randomUUID(), ml: 250, log_date: activityDay() };
  const downloaded = { id: crypto.randomUUID(), ml: 475, log_date: activityDay() };
  await changeMemberState(memberId, (state) => ({
    ...state,
    records: { water_logs: [downloaded] },
    references: {
      workoutHistory: { entries: ["downloaded"] },
      foodWindow: { from: activityDay(), to: activityDay() },
      waterUndo: [{ token: "pending-undo" }],
      cardioState: { queue: [{ id: "pending-cardio" }] },
      assignedTraining: { id: "frozen" },
    },
  }));
  await queueMemberWrites(memberId, [{ entity: "water_logs", op: "put", record: pending }]);
  const before = await readMemberState(memberId);
  const staleRead = await beginMemberRead(memberId);
  await expect(removeOfflineHistory(memberId)).resolves.toBe(true);
  await cacheNutritionWindow(
    memberId,
    [],
    [downloaded],
    { from: activityDay(), to: activityDay() },
    null,
    staleRead,
  );
  const after = await readMemberState(memberId);
  expect(after.queue).toEqual(before.queue);
  expect(after.records.water_logs?.map((row) => row.id)).toEqual([pending.id]);
  expect(after.references).toMatchObject({
    offlineHistoryPaused: true,
    waterUndo: before.references["waterUndo"],
    cardioState: before.references["cardioState"],
    assignedTraining: before.references["assignedTraining"],
  });
  expect(after.references["workoutHistory"]).toBeUndefined();
  expect(after.references["foodWindow"]).toBeUndefined();
  await prepareOfflineWorkspace(memberId);
  expect(prepareMemberOfflineData).not.toHaveBeenCalled();
  expect(prepareWorkoutHistory).not.toHaveBeenCalled();
  await prepareOfflineWorkspace(memberId, true);
  expect(prepareMemberOfflineData).toHaveBeenCalledOnce();
  expect(prepareWorkoutHistory).toHaveBeenCalledOnce();
  expect((await readMemberState(memberId)).references["offlineHistoryPaused"]).toBe(false);
});
it("does no download when both snapshots already cover today", async () => {
  await cacheFreshWorkspace(memberId);
  await expect(prepareOfflineWorkspace(memberId)).resolves.toBe(false);
  expect(prepareMemberOfflineData).not.toHaveBeenCalled();
  expect(prepareTrainingOfflineData).not.toHaveBeenCalled();
});
it("respects a recent failed attempt persisted by another tab", async () => {
  await changeMemberState(memberId, (state) => ({
    ...state,
    references: {
      offlinePreparationAttempt: { status: "failed", attemptedAt: new Date().toISOString() },
    },
  }));
  await expect(prepareOfflineWorkspace(memberId)).resolves.toBe(false);
  expect(prepareMemberOfflineData).not.toHaveBeenCalled();
  await expect(prepareOfflineWorkspace(memberId, true)).resolves.toBe(true);
});
it("records failed automatic attempts, backs off, and allows manual retry", async () => {
  vi.mocked(prepareTrainingOfflineData).mockRejectedValueOnce(new Error("Interrupted"));
  await expect(prepareOfflineWorkspace(memberId)).rejects.toThrow("Interrupted");
  expect((await readMemberState(memberId)).references["offlinePreparationAttempt"]).toMatchObject({
    status: "failed",
  });
  await expect(prepareOfflineWorkspace(memberId)).resolves.toBe(false);
  expect(prepareTrainingOfflineData).toHaveBeenCalledTimes(1);
  await expect(prepareOfflineWorkspace(memberId, true)).resolves.toBe(true);
  expect((await readMemberState(memberId)).references["offlinePreparationAttempt"]).toMatchObject({
    status: "succeeded",
  });
});

async function cacheFreshWorkspace(memberId: string) {
  const today = activityDay();
  await changeMemberState(memberId, (state) => ({
    ...state,
    references: {
      offlinePreparation: {
        version: 1,
        memberId,
        from: today,
        to: today,
        preparedAt: new Date().toISOString(),
        counts: {
          food_logs: 0,
          water_logs: 0,
          saved_meals: 0,
          body_measurements: 0,
          wellness_checkins: 0,
        },
      },
      workoutHistoryManifest: {
        version: 1,
        memberId,
        from: offlineHistoryStart(today),
        to: today,
        preparedAt: new Date().toISOString(),
        sessionCount: 0,
        setCount: 0,
      },
      workoutHistory: {},
      trainingPreparation: {
        version: 1,
        memberId,
        preparedAt: new Date().toISOString(),
        exerciseCount: 0,
        programName: null,
      },
    },
  }));
}

it("refreshes history immediately after a new accepted workout completion", async () => {
  await cacheFreshWorkspace(memberId);
  await changeWorkout(memberId, (workout) => ({
    ...workout,
    completion: {
      id: crypto.randomUUID(),
      title: "Completed",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationSeconds: 60,
      exercises: 1,
      loggedSets: 1,
      workingSets: 1,
      volumeKg: 100,
      holdSeconds: 0,
    },
  }));
  await expect(prepareOfflineWorkspace(memberId)).resolves.toBe(true);
  expect(prepareWorkoutHistory).toHaveBeenCalledTimes(1);
  expect(prepareMemberOfflineData).not.toHaveBeenCalled();
  expect(prepareTrainingOfflineData).not.toHaveBeenCalled();
});

it("queues a distinct date range behind active preparation without dropping it", async () => {
  let releaseDownload!: (value: Awaited<ReturnType<typeof prepareWorkoutHistory>>) => void;
  const blockedDownload = new Promise<Awaited<ReturnType<typeof prepareWorkoutHistory>>>(
    (resolve) => {
      releaseDownload = resolve;
    },
  );
  vi.mocked(prepareWorkoutHistory).mockReturnValueOnce(blockedDownload);
  const first = prepareOfflineWorkspace(memberId, true);
  const range = { from: "2020-01-01", to: "2020-02-01" };
  const additional = prepareAdditionalWorkoutHistory(memberId, range);
  const duplicate = prepareAdditionalWorkoutHistory(memberId, range);
  expect(additional).toBe(duplicate);
  expect(additional).not.toBe(first);
  await vi.waitFor(() => expect(prepareWorkoutHistory).toHaveBeenCalledTimes(1));
  releaseDownload({} as never);
  await Promise.all([first, additional]);
  expect(prepareWorkoutHistory).toHaveBeenCalledTimes(2);
  expect(prepareWorkoutHistory).toHaveBeenLastCalledWith(memberId, range);
});

it("keeps recent coverage fresh after an additional older-range download", async () => {
  await cacheFreshWorkspace(memberId);
  const today = activityDay();
  await changeMemberState(memberId, (state) => ({
    ...state,
    references: {
      ...state.references,
      workoutHistoryManifest: {
        version: 1,
        memberId,
        from: "2020-01-01",
        to: "2020-01-31",
        preparedAt: new Date().toISOString(),
        sessionCount: 0,
        setCount: 0,
        coverage: [
          { from: "2020-01-01", to: "2020-01-31" },
          { from: offlineHistoryStart(today), to: today },
        ],
      },
    },
  }));
  await expect(prepareOfflineWorkspace(memberId)).resolves.toBe(false);
  expect(prepareWorkoutHistory).not.toHaveBeenCalled();
});
