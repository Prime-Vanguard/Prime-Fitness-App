import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "./pagination";
import { activityDay } from "./dates";
import {
  defaultHistoryDownloadRange,
  downloadedHistoryCoverage,
  historyDownloadRangeSchema,
  mergeHistoryCoverage,
  type HistoryDateRange,
} from "./history-download-range";
import { historyDateFilter, literalTitlePattern, type TrainSearch } from "./training-search";
import {
  isTransientConnectionError,
  readOfflineIdentity,
  withConnectionTimeout,
} from "./offline-access";
import { changeMemberState } from "./member-store";
import {
  OfflineHistoryUnavailableError,
  historyEntrySchema,
  historySessionSchema,
  readOfflineHistoryEntry,
  readOfflineHistoryPage,
  validateHistoryOwnership,
  workoutHistorySnapshotSchema,
  workoutHistoryManifestSchema,
} from "./workout-history-cache";
import type { Tables } from "@/integrations/supabase/types";
import { readWorkout } from "./workout-store";

export const WORKOUT_HISTORY_SELECT =
  "id,member_id,title,started_at,finished_at,origin,activity_date,time_precision,set_logs(count)" as const;
function isHistoryConnectionError(error: unknown): boolean {
  // Pagination normalizes API errors to Error(message); retain only recognizable
  // fetch-failure fallback, never permission or arbitrary programming errors.
  return (
    isTransientConnectionError(error) ||
    (error instanceof Error && isTransientConnectionError({ code: "", message: error.message }))
  );
}
export async function loadWorkoutHistoryPage(
  memberId: string,
  search: Pick<TrainSearch, "q" | "from" | "to" | "page">,
  signal: AbortSignal,
) {
  if (!navigator.onLine) return readOfflineHistoryPage(memberId, search);
  try {
    let query = supabase
      .from("workout_sessions")
      .select(WORKOUT_HISTORY_SELECT)
      .eq("member_id", memberId)
      .not("finished_at", "is", null);
    if (search.q) query = query.ilike("title", literalTitlePattern(search.q));
    const dateFilter = historyDateFilter(search.from, search.to);
    if (dateFilter) query = query.or(dateFilter);
    const offset = (search.page ?? 0) * 20;
    const response = await query
      .order("started_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 19)
      .abortSignal(signal);
    if (response.error) throw response.error;
    return {
      rows: response.data,
      source: "server" as const,
      from: undefined,
      to: undefined,
      coverage: undefined,
      hasIncompleteDateCoverage: false,
    };
  } catch (error) {
    if (isHistoryConnectionError(error)) return readOfflineHistoryPage(memberId, search);
    throw error;
  }
}
export async function loadWorkoutHistorySummary(
  memberId: string,
  sessionId: string,
  signal: AbortSignal,
) {
  if (!navigator.onLine) return (await readOfflineHistoryEntry(memberId, sessionId)).session;
  try {
    const response = await supabase
      .from("workout_sessions")
      .select(WORKOUT_HISTORY_SELECT)
      .eq("member_id", memberId)
      .eq("id", sessionId)
      .not("finished_at", "is", null)
      .abortSignal(signal)
      .maybeSingle();
    if (response.error) throw response.error;
    return response.data;
  } catch (error) {
    if (isHistoryConnectionError(error))
      return (await readOfflineHistoryEntry(memberId, sessionId)).session;
    throw error;
  }
}
export async function loadWorkoutHistoryDetails(
  memberId: string,
  sessionId: string,
  signal: AbortSignal,
): Promise<{ slots: Tables<"workout_exercises">[]; sets: Tables<"set_logs">[] }> {
  if (!navigator.onLine) return readOfflineHistoryEntry(memberId, sessionId);
  try {
    const [slots, sets] = await Promise.all([
      fetchAll(
        (first, last) =>
          supabase
            .from("workout_exercises")
            .select("*")
            .eq("member_id", memberId)
            .eq("session_id", sessionId)
            .order("id")
            .range(first, last)
            .abortSignal(signal),
        (slot) => slot.id,
      ),
      fetchAll(
        (first, last) =>
          supabase
            .from("set_logs")
            .select("*")
            .eq("member_id", memberId)
            .eq("session_id", sessionId)
            .order("set_number")
            .order("id")
            .range(first, last)
            .abortSignal(signal),
        (set) => set.id,
      ),
    ]);
    return { slots, sets };
  } catch (error) {
    if (isHistoryConnectionError(error)) return readOfflineHistoryEntry(memberId, sessionId);
    throw error;
  }
}

function requireHistoryIdentity(memberId: string) {
  if (!navigator.onLine || readOfflineIdentity()?.id !== memberId)
    throw new Error("History preparation requires the same account and a connection.");
}
/** Every page and detail must succeed before the previous history download is replaced. */
export async function prepareWorkoutHistory(
  memberId: string,
  requestedRange: HistoryDateRange = defaultHistoryDownloadRange(),
) {
  const { from, to } = historyDownloadRangeSchema.parse(requestedRange);
  requireHistoryIdentity(memberId);
  const completion = (await readWorkout(memberId)).completion;
  const completionDate = completion ? activityDay(completion.startedAt) : undefined;
  const acknowledgedCompletionId =
    completionDate && completionDate >= from && completionDate <= to ? completion?.id : undefined;
  const { data: auth, error: authError } = await withConnectionTimeout(supabase.auth.getUser());
  if (authError) throw authError;
  if (auth.user?.id !== memberId)
    throw new Error("Sign in to the same account before downloading history.");
  const profile = await supabase
    .from("profiles")
    .select("access_active")
    .eq("id", memberId)
    .abortSignal(AbortSignal.timeout(15000))
    .maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data?.access_active) throw new Error("Active member access is required.");
  const sessions = await fetchAll(
    (first, last) =>
      supabase
        .from("workout_sessions")
        .select(WORKOUT_HISTORY_SELECT)
        .eq("member_id", memberId)
        .not("finished_at", "is", null)
        .or(historyDateFilter(from, to)!)
        .order("started_at", { ascending: false })
        .order("id")
        .range(first, last)
        .abortSignal(AbortSignal.timeout(15000)),
    (session) => session.id,
  );
  const parsedSessions = sessions.map((session) => historySessionSchema.parse(session));
  const slots: Tables<"workout_exercises">[] = [];
  const sets: Tables<"set_logs">[] = [];
  // Batches keep filter URLs bounded without issuing one request for every session.
  for (let offset = 0; offset < parsedSessions.length; offset += 50) {
    requireHistoryIdentity(memberId);
    const sessionIds = parsedSessions.slice(offset, offset + 50).map((session) => session.id);
    const [batchSlots, batchSets] = await Promise.all([
      fetchAll(
        (first, last) =>
          supabase
            .from("workout_exercises")
            .select("*")
            .eq("member_id", memberId)
            .in("session_id", sessionIds)
            .order("id")
            .range(first, last)
            .abortSignal(AbortSignal.timeout(15000)),
        (slot) => slot.id,
      ),
      fetchAll(
        (first, last) =>
          supabase
            .from("set_logs")
            .select("*")
            .eq("member_id", memberId)
            .in("session_id", sessionIds)
            .order("id")
            .range(first, last)
            .abortSignal(AbortSignal.timeout(15000)),
        (set) => set.id,
      ),
    ]);
    if (
      batchSlots.some((slot) => !sessionIds.includes(slot.session_id)) ||
      batchSets.some((set) => !sessionIds.includes(set.session_id))
    )
      throw new Error("History session ownership could not be verified.");
    slots.push(...batchSlots);
    sets.push(...batchSets);
  }
  const entries = parsedSessions.map((session) =>
    historyEntrySchema.parse({
      session,
      slots: slots.filter((slot) => slot.session_id === session.id),
      sets: sets.filter((set) => set.session_id === session.id),
    }),
  );
  const snapshot = workoutHistorySnapshotSchema.parse({
    version: 1,
    memberId,
    from,
    to,
    preparedAt: new Date().toISOString(),
    entries,
  });
  validateHistoryOwnership(snapshot, memberId);
  requireHistoryIdentity(memberId);
  await changeMemberState(memberId, (state) => {
    requireHistoryIdentity(memberId);
    const previous = workoutHistorySnapshotSchema.safeParse(state.references["workoutHistory"]);
    let retained: typeof snapshot.entries = [];
    let priorCoverage: HistoryDateRange[] = [];
    if (previous.success && previous.data.memberId === memberId) {
      try {
        validateHistoryOwnership(previous.data, memberId);
        priorCoverage = downloadedHistoryCoverage(previous.data);
        retained = previous.data.entries.filter((entry) => {
          const date = entry.session.activity_date ?? activityDay(entry.session.started_at);
          return (
            (date < from || date > to) &&
            !snapshot.entries.some((updated) => updated.session.id === entry.session.id)
          );
        });
      } catch (error) {
        // A valid fresh download can recover an invalid old cache, never copy it.
        if (!(error instanceof OfflineHistoryUnavailableError)) throw error;
      }
    }
    const mergedSnapshot = {
      ...snapshot,
      coverage: mergeHistoryCoverage([...priorCoverage, { from, to }]),
      entries: [...snapshot.entries, ...retained],
    };
    validateHistoryOwnership(mergedSnapshot, memberId);
    const previousManifest = workoutHistoryManifestSchema.safeParse(
      state.references["workoutHistoryManifest"],
    );
    const manifest = workoutHistoryManifestSchema.parse({
      ...mergedSnapshot,
      lastCompletionId:
        acknowledgedCompletionId ??
        (previousManifest.success && previousManifest.data.memberId === memberId
          ? previousManifest.data.lastCompletionId
          : null),
      sessionCount: mergedSnapshot.entries.length,
      setCount: mergedSnapshot.entries.reduce((total, entry) => total + entry.sets.length, 0),
    });
    return {
      ...state,
      references: {
        ...state.references,
        workoutHistory: mergedSnapshot,
        workoutHistoryManifest: manifest,
      },
    };
  });
  return snapshot;
}
