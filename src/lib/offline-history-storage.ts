import { type MemberEntity, type MemberState } from "./member-store";

const removableEntities = [
  "food_logs",
  "water_logs",
  "body_measurements",
  "wellness_checkins",
] as const satisfies readonly MemberEntity[];

function historyOnlyRecords(state: MemberState) {
  return removableEntities.map((entity) => {
    const pendingIds = new Set(
      state.queue
        .filter((mutation) => mutation.entity === entity)
        .map((mutation) => mutation.record_id),
    );
    return {
      entity,
      removable: (state.records[entity] ?? []).filter((record) => !pendingIds.has(record.id)),
      pending: (state.records[entity] ?? []).filter((record) => pendingIds.has(record.id)),
    };
  });
}

export function removableHistoryBytes(state: MemberState) {
  const rows = historyOnlyRecords(state).flatMap(({ removable }) => removable);
  const workoutHistory = state.references["workoutHistory"];
  if (!rows.length && !workoutHistory) return 0;
  return new Blob([JSON.stringify({ rows, workoutHistory })]).size;
}

export function removeDownloadedHistory(state: MemberState): MemberState {
  const records = { ...state.records };
  const cacheEpochs = { ...state.cacheEpochs };
  for (const { entity, pending } of historyOnlyRecords(state)) {
    records[entity] = pending;
    // Responses that began before removal must not repopulate the deleted cache.
    cacheEpochs[entity] = (cacheEpochs[entity] ?? 0) + 1;
  }
  const references = { ...state.references };
  for (const key of [
    "offlinePreparation",
    "personalHistoryCoverage",
    "foodWindow",
    "workoutHistory",
    "workoutHistoryManifest",
  ])
    delete references[key];
  references["offlineHistoryPaused"] = true;
  references["offlineHistoryRemovalId"] = crypto.randomUUID();
  return { ...state, records, cacheEpochs, references };
}

/**
 * Explicit sign-out on a possibly shared device: drop downloaded history but keep unsent
 * work, and keep the member's automatic-download choice for their next sign-in.
 */
export function signOutHistory(state: MemberState): MemberState {
  const removed = removeDownloadedHistory(state);
  const paused = state.references["offlineHistoryPaused"] === true;
  return { ...removed, references: { ...removed.references, offlineHistoryPaused: paused } };
}
