import { z } from "zod";
import { readMemberState } from "./member-store";
import { setDetailsSchema } from "./training-model";
import { activityDay } from "./dates";
import type { TrainSearch } from "./training-search";
import {
  historyCoverageRangeSchema,
  downloadedHistoryCoverage,
  historyRangeIsCovered,
} from "./history-download-range";

const identifier = z.string().min(1);
const timestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid history timestamp");
export const historySessionSchema = z.object({
  id: identifier,
  member_id: identifier,
  title: z.string().nullable(),
  started_at: timestamp,
  finished_at: timestamp,
  activity_date: z.iso.date().nullable(),
  origin: z.string(),
  time_precision: z.string(),
  set_logs: z.array(z.object({ count: z.number().int().nonnegative() })),
});
const historySlotSchema = z.object({
  id: identifier,
  member_id: identifier,
  session_id: identifier,
  exercise_id: identifier,
  slot_key: z.string(),
  snapshot: z.json(),
});
const historySetSchema = z
  .object({
    id: identifier,
    member_id: identifier,
    session_id: identifier,
    exercise_id: identifier,
    set_number: z.number().int().positive(),
    reps: z.number().nullable(),
    weight_kg: z.number().nullable(),
    rpe: z.number().nullable(),
    created_at: z.string(),
    workout_exercise_id: identifier.nullable(),
  })
  .extend(setDetailsSchema.shape);
export const historyEntrySchema = z.object({
  session: historySessionSchema,
  slots: z.array(historySlotSchema),
  sets: z.array(historySetSchema),
});
export const workoutHistorySnapshotSchema = z.object({
  version: z.literal(1),
  memberId: identifier,
  preparedAt: z.iso.datetime(),
  from: z.iso.date(),
  to: z.iso.date(),
  coverage: z.array(historyCoverageRangeSchema).default([]),
  entries: z.array(historyEntrySchema),
});
export type WorkoutHistorySnapshot = z.output<typeof workoutHistorySnapshotSchema>;
export const workoutHistoryManifestSchema = workoutHistorySnapshotSchema
  .omit({ entries: true })
  .extend({
    lastCompletionId: z.string().nullable().default(null),
    sessionCount: z.number().int().nonnegative(),
    setCount: z.number().int().nonnegative(),
  });
export type WorkoutHistorySummary = z.output<typeof historySessionSchema>;
export type WorkoutHistoryEntry = z.output<typeof historyEntrySchema>;
export class OfflineHistoryUnavailableError extends Error {
  constructor() {
    super("Download workout history online before opening it offline.");
    this.name = "OfflineHistoryUnavailableError";
  }
}

export function validateHistoryOwnership(snapshot: WorkoutHistorySnapshot, memberId: string) {
  if (snapshot.memberId !== memberId) throw new OfflineHistoryUnavailableError();
  const sessionIds = new Set<string>();
  for (const entry of snapshot.entries) {
    const { session, slots, sets } = entry;
    if (session.member_id !== memberId || sessionIds.has(session.id))
      throw new OfflineHistoryUnavailableError();
    sessionIds.add(session.id);
    const slotById = new Map(slots.map((slot) => [slot.id, slot]));
    if (slotById.size !== slots.length || new Set(sets.map((set) => set.id)).size !== sets.length)
      throw new OfflineHistoryUnavailableError();
    if (
      slots.some((slot) => slot.member_id !== memberId || slot.session_id !== session.id) ||
      sets.some(
        (set) =>
          set.member_id !== memberId ||
          set.session_id !== session.id ||
          (set.workout_exercise_id !== null &&
            slotById.get(set.workout_exercise_id)?.exercise_id !== set.exercise_id),
      )
    )
      throw new OfflineHistoryUnavailableError();
    if ((session.set_logs[0]?.count ?? 0) !== sets.length)
      throw new OfflineHistoryUnavailableError();
  }
}

export async function readWorkoutHistorySnapshot(
  memberId: string,
): Promise<WorkoutHistorySnapshot> {
  const snapshot = workoutHistorySnapshotSchema.safeParse(
    (await readMemberState(memberId)).references["workoutHistory"],
  );
  if (!snapshot.success) throw new OfflineHistoryUnavailableError();
  validateHistoryOwnership(snapshot.data, memberId);
  return snapshot.data;
}

export async function readOfflineHistoryPage(
  memberId: string,
  search: Pick<TrainSearch, "q" | "from" | "to" | "page">,
) {
  const snapshot = await readWorkoutHistorySnapshot(memberId);
  const query = search.q?.toLowerCase();
  const rows = snapshot.entries
    .map((entry) => entry.session)
    .filter((session) => {
      const date = session.activity_date ?? activityDay(session.started_at);
      return (
        (!query || (session.title ?? "").toLowerCase().includes(query)) &&
        (!search.from || date >= search.from) &&
        (!search.to || date <= search.to)
      );
    })
    .sort(
      (first, second) =>
        Date.parse(second.started_at) - Date.parse(first.started_at) ||
        second.id.localeCompare(first.id),
    );
  const offset = (search.page ?? 0) * 20;
  const coverage = downloadedHistoryCoverage(snapshot);
  const hasIncompleteDateCoverage =
    !!(search.from || search.to) &&
    !(
      search.from &&
      search.to &&
      historyRangeIsCovered({ from: search.from, to: search.to }, coverage)
    );
  return {
    rows: rows.slice(offset, offset + 20),
    source: "device" as const,
    from: snapshot.from,
    to: snapshot.to,
    coverage,
    hasIncompleteDateCoverage,
  };
}

export async function readOfflineHistoryEntry(memberId: string, sessionId: string) {
  const snapshot = await readWorkoutHistorySnapshot(memberId);
  const entry = snapshot.entries.find((candidate) => candidate.session.id === sessionId);
  if (!entry) throw new OfflineHistoryUnavailableError();
  return entry;
}
