import { expect, it } from "vitest";
import {
  historyDownloadRangeSchema,
  mergeHistoryCoverage,
  historyRangeIsCovered,
  downloadedHistoryCoverage,
} from "./history-download-range";
import { activityDay, addDays } from "./dates";

it.each([
  { from: "", to: "" },
  { from: "not-a-date", to: "2020-01-01" },
  { from: "2020-02-30", to: "2020-03-01" },
  { from: "2020-02-01", to: "2020-01-01" },
  { from: "2020-01-01", to: "2022-01-01" },
])("rejects invalid ranges without throwing during form validation: %j", (range) => {
  expect(historyDownloadRangeSchema.safeParse(range).success).toBe(false);
});
it("accepts a leap-year-sized download and rejects future dates", () => {
  const today = activityDay();
  expect(
    historyDownloadRangeSchema.safeParse({ from: addDays(today, -365), to: today }).success,
  ).toBe(true);
  expect(historyDownloadRangeSchema.safeParse({ from: today, to: addDays(today, 1) }).success).toBe(
    false,
  );
});
it("merges overlaps and adjacent dates while preserving gaps", () => {
  const coverage = mergeHistoryCoverage([
    { from: "2020-03-01", to: "2020-03-10" },
    { from: "2020-01-01", to: "2020-01-10" },
    { from: "2020-01-11", to: "2020-01-20" },
    { from: "2020-01-05", to: "2020-01-15" },
  ]);
  expect(coverage).toEqual([
    { from: "2020-01-01", to: "2020-01-20" },
    { from: "2020-03-01", to: "2020-03-10" },
  ]);
  expect(historyRangeIsCovered({ from: "2020-02-01", to: "2020-02-02" }, coverage)).toBe(false);
});
it("keeps initial unversioned coverage compatible with existing snapshots", () => {
  expect(downloadedHistoryCoverage({ from: "2020-01-01", to: "2020-01-31" })).toEqual([
    { from: "2020-01-01", to: "2020-01-31" },
  ]);
});
