import { z } from "zod";
import { activityDay, addDays } from "./dates";
import { offlineHistoryStart } from "./offline-window";
import { validActivityDate } from "./training-search";
import type { MemberState } from "./member-store";

export const historyCoverageRangeSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((range) => range.from <= range.to, "The start date must not follow the end date.");
export type HistoryDateRange = z.output<typeof historyCoverageRangeSchema>;
export const historyDownloadRangeSchema = historyCoverageRangeSchema
  .refine((range) => range.to <= activityDay(), "Future history cannot be downloaded.")
  .refine(
    (range) => validActivityDate(range.from) && range.to <= addDays(range.from, 365),
    "Download at most 366 days at a time.",
  );

export function defaultHistoryDownloadRange(): HistoryDateRange {
  const to = activityDay();
  return { from: offlineHistoryStart(to), to };
}

/** Merge overlaps and adjacent dates; disjoint downloads must retain their gaps. */
export function mergeHistoryCoverage(ranges: readonly HistoryDateRange[]): HistoryDateRange[] {
  const sorted = ranges
    .map((range) => historyCoverageRangeSchema.parse(range))
    .sort((first, second) => first.from.localeCompare(second.from));
  const merged: HistoryDateRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range.from <= addDays(previous.to, 1))
      previous.to = previous.to > range.to ? previous.to : range.to;
    else merged.push({ ...range });
  }
  return merged;
}

export function downloadedHistoryCoverage(
  snapshot: HistoryDateRange & { coverage?: HistoryDateRange[] },
): HistoryDateRange[] {
  return mergeHistoryCoverage([
    ...(snapshot.coverage ?? []),
    { from: snapshot.from, to: snapshot.to },
  ]);
}

export function historyRangeIsCovered(
  request: HistoryDateRange,
  coverage: readonly HistoryDateRange[],
): boolean {
  return coverage.some((range) => range.from <= request.from && range.to >= request.to);
}

export const offlinePreparationSchema = z.object({
  version: z.literal(1),
  memberId: z.string().min(1),
  preparedAt: z.iso.datetime(),
  ...historyCoverageRangeSchema.shape,
  counts: z.object({
    food_logs: z.number().int().nonnegative(),
    water_logs: z.number().int().nonnegative(),
    body_measurements: z.number().int().nonnegative(),
    wellness_checkins: z.number().int().nonnegative(),
    saved_meals: z.number().int().nonnegative(),
  }),
});

const personalCoverageSchema = z.array(historyCoverageRangeSchema);

export function personalHistoryCoverage(state: MemberState, memberId: string): HistoryDateRange[] {
  const recent = offlinePreparationSchema.safeParse(state.references["offlinePreparation"]);
  const selected = personalCoverageSchema.safeParse(state.references["personalHistoryCoverage"]);
  const recentRange =
    recent.success && recent.data.memberId === memberId && recent.data.from <= recent.data.to
      ? [{ from: recent.data.from, to: recent.data.to }]
      : [];
  return mergeHistoryCoverage([...recentRange, ...(selected.success ? selected.data : [])]);
}
