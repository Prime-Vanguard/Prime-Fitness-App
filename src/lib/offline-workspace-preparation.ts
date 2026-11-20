import { z } from "zod";
import { deviceScope } from "./device-scope";
import { readOfflineIdentity } from "./offline-access";
import { offlinePreparationSchema, prepareMemberOfflineData } from "./offline-preparation";
import {
  prepareTrainingOfflineData,
  trainingPreparationSchema,
} from "./offline-training-preparation";
import { changeMemberState, readMemberState } from "./member-store";
import { activityDay } from "./dates";
import { workoutHistoryManifestSchema } from "./workout-history-cache";
import { prepareWorkoutHistory } from "./workout-history-data";
import { readWorkout } from "./workout-store";
import { removeDownloadedHistory } from "./offline-history-storage";
import {
  defaultHistoryDownloadRange,
  downloadedHistoryCoverage,
  historyRangeIsCovered,
  historyDownloadRangeSchema,
  type HistoryDateRange,
} from "./history-download-range";

export const preparationAttemptSchema = z.object({
  attemptedAt: z.iso.datetime(),
  status: z.enum(["failed", "succeeded"]),
});
const activePreparations = new Map<string, Promise<boolean>>();
const preparationTails = new Map<string, Promise<boolean>>();
const automaticAttempts = new Map<string, number>();
const AUTOMATIC_RETRY_DELAY_MS = 60_000;

/** Manual, reconnect and foreground preparation share one owner per account/project. */
export function prepareOfflineWorkspace(memberId: string, forceDownload = false): Promise<boolean> {
  const scope = deviceScope(memberId);
  const prepare = async (): Promise<boolean> => {
    if (!navigator.onLine || readOfflineIdentity()?.id !== memberId) return false;
    const [state, workout] = await Promise.all([readMemberState(memberId), readWorkout(memberId)]);
    const member = offlinePreparationSchema.safeParse(state.references["offlinePreparation"]);
    const training = trainingPreparationSchema.safeParse(state.references["trainingPreparation"]);
    const today = activityDay();
    const refreshHistory = forceDownload || state.references["offlineHistoryPaused"] !== true;
    const history = workoutHistoryManifestSchema.safeParse(
      state.references["workoutHistoryManifest"],
    );
    const needsHistory =
      refreshHistory &&
      (forceDownload ||
        !history.success ||
        history.data.memberId !== memberId ||
        activityDay(history.data.preparedAt) !== today ||
        !historyRangeIsCovered(
          defaultHistoryDownloadRange(),
          downloadedHistoryCoverage(history.data),
        ) ||
        !state.references["workoutHistory"]);
    const hasNewCompletion =
      refreshHistory &&
      !!workout.completion &&
      historyRangeIsCovered(
        {
          from: activityDay(workout.completion.startedAt),
          to: activityDay(workout.completion.startedAt),
        },
        [defaultHistoryDownloadRange()],
      ) &&
      (!history.success || history.data.lastCompletionId !== workout.completion.id);
    const needsMember =
      refreshHistory &&
      (forceDownload ||
        !member.success ||
        member.data.memberId !== memberId ||
        member.data.to !== today);
    const needsTraining =
      forceDownload ||
      !training.success ||
      training.data.memberId !== memberId ||
      activityDay(new Date(training.data.preparedAt)) !== today;
    if (!needsMember && !needsTraining && !needsHistory && !hasNewCompletion) return false;
    const previousAttempt = preparationAttemptSchema.safeParse(
      state.references["offlinePreparationAttempt"],
    );
    const lastAttemptAt = Math.max(
      automaticAttempts.get(scope) ?? 0,
      previousAttempt.success ? Date.parse(previousAttempt.data.attemptedAt) : 0,
    );
    const canRefreshCompletionNow =
      hasNewCompletion && (!previousAttempt.success || previousAttempt.data.status !== "failed");
    if (
      !forceDownload &&
      !canRefreshCompletionNow &&
      Date.now() - lastAttemptAt < AUTOMATIC_RETRY_DELAY_MS
    )
      return false;
    automaticAttempts.set(scope, Date.now());
    try {
      if (needsMember) await prepareMemberOfflineData(memberId);
      if (needsTraining) await prepareTrainingOfflineData(memberId);
      if (needsHistory || hasNewCompletion) await prepareWorkoutHistory(memberId);
      if (forceDownload && state.references["offlineHistoryPaused"] === true)
        await changeMemberState(memberId, (current) => {
          if (readOfflineIdentity()?.id !== memberId)
            throw new Error("The signed-in account changed during offline preparation.");
          return { ...current, references: { ...current.references, offlineHistoryPaused: false } };
        });
      await recordAttempt("succeeded");
      return true;
    } catch (error) {
      await recordAttempt("failed");
      throw error;
    }
    async function recordAttempt(status: "failed" | "succeeded") {
      if (readOfflineIdentity()?.id !== memberId) return;
      try {
        await changeMemberState(memberId, (current) =>
          readOfflineIdentity()?.id !== memberId
            ? current
            : {
                ...current,
                references: {
                  ...current.references,
                  offlinePreparationAttempt: { status, attemptedAt: new Date().toISOString() },
                },
              },
        );
      } catch {
        /* Storage failure cannot erase already committed work. */
      }
    }
  };
  return runScopedPreparation(memberId, forceDownload ? "manual-workspace" : "workspace", prepare);
}

export function removeOfflineHistory(memberId: string): Promise<boolean> {
  return runScopedPreparation(memberId, "remove-history", async () => {
    await changeMemberState(memberId, (state) => {
      if (readOfflineIdentity()?.id !== memberId)
        throw new Error("The signed-in account changed before history was removed.");
      return removeDownloadedHistory(state);
    });
    return true;
  });
}

/** Explicit ranges queue behind ongoing automatic work instead of being ignored. */
export function prepareAdditionalPersonalHistory(
  memberId: string,
  requestedRange: HistoryDateRange,
): Promise<boolean> {
  const range = { ...requestedRange };
  return runScopedPreparation(
    memberId,
    JSON.stringify(["personal-history", range.from, range.to]),
    async () => {
      await prepareMemberOfflineData(memberId, range);
      return true;
    },
  );
}

export function prepareAdditionalWorkoutHistory(
  memberId: string,
  requestedRange: HistoryDateRange,
): Promise<boolean> {
  const rangeInput = { ...requestedRange };
  const requestKey = JSON.stringify(["history", rangeInput.from, rangeInput.to]);
  return runScopedPreparation(memberId, requestKey, async () => {
    const range = historyDownloadRangeSchema.parse(rangeInput);
    await prepareWorkoutHistory(memberId, range);
    return true;
  });
}

function runScopedPreparation(
  memberId: string,
  requestKey: string,
  prepare: () => Promise<boolean>,
): Promise<boolean> {
  const scope = deviceScope(memberId);
  const identity = JSON.stringify([scope, requestKey]);
  const active = activePreparations.get(identity);
  if (active) return active;
  const predecessor = preparationTails.get(scope);
  const preparation = Promise.resolve(predecessor)
    .catch(() => false)
    .then(async () => {
      if (navigator.locks) {
        return await navigator.locks.request(
          `pf-offline-preparation:${scope}`,
          async () => await prepare(),
        );
      }
      return await prepare();
    })
    .finally(() => {
      activePreparations.delete(identity);
      if (preparationTails.get(scope) === preparation) preparationTails.delete(scope);
    });
  activePreparations.set(identity, preparation);
  preparationTails.set(scope, preparation);
  return preparation;
}
