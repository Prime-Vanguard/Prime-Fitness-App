import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  defaultHistoryDownloadRange,
  historyDownloadRangeSchema,
  mergeHistoryCoverage,
  offlinePreparationSchema,
  personalHistoryCoverage,
  type HistoryDateRange,
} from "./history-download-range";

// Kept here for existing importers; the definitions live beside the range helpers
// so the member store can read coverage without an import cycle.
export { offlinePreparationSchema, personalHistoryCoverage };
import { readOfflineIdentity, withConnectionTimeout } from "./offline-access";
import {
  beginMemberRead,
  changeMemberState,
  mergeDownloadedMemberRows,
  type MemberEntity,
  type MemberRecord,
} from "./member-store";
import { fetchAll } from "./pagination";

export const PREPARED_MEMBER_ENTITIES = [
  "food_logs",
  "water_logs",
  "body_measurements",
  "wellness_checkins",
  "saved_meals",
] as const satisfies readonly MemberEntity[];
function requireCurrentIdentity(memberId: string) {
  if (!navigator.onLine || readOfflineIdentity()?.id !== memberId)
    throw new Error("Offline preparation requires the same signed-in account and a connection.");
}

/** Publish the manifest and downloaded rows in one transaction, after every read succeeds. */
export async function prepareMemberOfflineData(
  memberId: string,
  requestedRange?: HistoryDateRange,
) {
  const range = requestedRange
    ? historyDownloadRangeSchema.parse(requestedRange)
    : defaultHistoryDownloadRange();
  const { from, to } = range;
  requireCurrentIdentity(memberId);
  const { data: auth, error: authError } = await withConnectionTimeout(supabase.auth.getUser());
  if (authError) throw authError;
  if (auth.user?.id !== memberId)
    throw new Error("Sign in to the same account before preparing offline data.");
  const profile = await supabase
    .from("profiles")
    .select("access_active")
    .eq("id", memberId)
    .abortSignal(AbortSignal.timeout(15000))
    .maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data?.access_active) throw new Error("Active member access is required.");
  const cacheEpochs = await beginMemberRead(memberId);
  const downloadRows = (entity: (typeof PREPARED_MEMBER_ENTITIES)[number]) =>
    fetchAll(
      (first, last) => {
        let query = supabase.from(entity).select("*").eq("member_id", memberId);
        if (entity !== "saved_meals") {
          const dateColumn = entity === "body_measurements" ? "measured_on" : "log_date";
          query = query.gte(dateColumn, from).lte(dateColumn, to);
        }
        return query.order("id").range(first, last).abortSignal(AbortSignal.timeout(15000));
      },
      (row) => row.id,
    );
  const [downloadedEntities, targets, features] = await Promise.all([
    Promise.all(PREPARED_MEMBER_ENTITIES.map(downloadRows)),
    supabase
      .from("nutrition_targets")
      .select("*")
      .eq("member_id", memberId)
      .abortSignal(AbortSignal.timeout(15000))
      .maybeSingle(),
    supabase.rpc("get_training_features").abortSignal(AbortSignal.timeout(15000)),
  ]);
  if (targets.error) throw targets.error;
  if (targets.data && targets.data.member_id !== memberId)
    throw new Error("Downloaded target ownership could not be verified.");
  if (features.error) throw features.error;
  const featureAvailability = z.record(z.string(), z.boolean()).parse(features.data);
  if (featureAvailability["offline"] !== true)
    throw new Error("Offline logging is not available for this account.");
  for (const rows of downloadedEntities) {
    if (rows.some((row) => row.member_id !== memberId))
      throw new Error("Downloaded record ownership could not be verified.");
  }
  const counts = Object.fromEntries(
    PREPARED_MEMBER_ENTITIES.map((entity, index) => [entity, downloadedEntities[index]!.length]),
  );
  const manifest = offlinePreparationSchema.parse({
    version: 1,
    memberId,
    from,
    to,
    preparedAt: new Date().toISOString(),
    counts,
  });
  requireCurrentIdentity(memberId);
  await changeMemberState(memberId, (state) => {
    requireCurrentIdentity(memberId);
    if (
      PREPARED_MEMBER_ENTITIES.some(
        (entity) => (state.cacheEpochs?.[entity] ?? 0) !== (cacheEpochs[entity] ?? 0),
      )
    )
      throw new Error(
        "Local records changed during preparation. Your changes are retained; retry the download.",
      );
    const records = { ...state.records };
    PREPARED_MEMBER_ENTITIES.forEach((entity, index) => {
      records[entity] = mergeDownloadedMemberRows(
        state,
        entity,
        downloadedEntities[index]! as MemberRecord[],
        memberId,
        { from, to },
      );
    });
    return {
      ...state,
      records,
      references: {
        ...state.references,
        targets: targets.data,
        trainingFeatures: featureAvailability,
        personalHistoryCoverage: mergeHistoryCoverage([
          ...personalHistoryCoverage(state, memberId),
          range,
        ]),
        ...(requestedRange ? {} : { foodWindow: range, offlinePreparation: manifest }),
      },
    };
  });
  return manifest;
}
