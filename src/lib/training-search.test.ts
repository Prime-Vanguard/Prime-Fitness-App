import { expect, it } from "vitest";
import { activityDay } from "./dates";
import {
  cairoDayStart,
  historyDateFilter,
  literalTitlePattern,
  trainingSearch,
} from "./training-search";
it("validates section/filter/page/session links without accepting malformed values", () => {
  const search = trainingSearch({
    section: "history",
    q: "  Leg day  ",
    from: "2026-10-01",
    to: "2026-10-30",
    page: "2",
    session: "00000000-0000-4000-8000-000000000001",
  });
  expect(search.q).toBe("Leg day");
  expect(search.page).toBe(2);
  expect(search.section).toBe("history");
  expect(trainingSearch({ page: true, from: "0000-01-01" }).page).toBeUndefined();
  expect(trainingSearch({ page: true, from: "0000-01-01" }).from).toBeUndefined();
  expect(trainingSearch({ session: "A0000000-0000-4000-8000-000000000001" }).session).toBe(
    "a0000000-0000-4000-8000-000000000001",
  );
  expect(
    trainingSearch({
      section: "admin",
      page: -1,
      from: "2026-02-30",
      to: "oops",
      session: "not-a-uuid",
    }),
  ).toEqual({});
  expect(trainingSearch({ page: 1e99, q: "x".repeat(200) }).q).toHaveLength(100);
});
it("escapes SQL LIKE wildcards for literal workout-title searches", () => {
  expect(literalTitlePattern("100%_\\pump")).toBe("%100\\%\\_\\\\pump%");
});
it.each(["2026-04-24", "2026-10-30", "2026-01-01", "2026-07-15"])(
  "finds the first instant of Cairo date %s across DST and midnight",
  (day) => {
    const first = Date.parse(cairoDayStart(day));
    expect(activityDay(first)).toBe(day);
    expect(activityDay(first - 1) < day).toBe(true);
  },
);
it("filters explicit import dates and legacy timestamp-only sessions without dropping either", () => {
  const filter = historyDateFilter("2026-10-01", "2026-10-30")!;
  expect(filter).toContain("and(activity_date.gte.2026-10-01,activity_date.lte.2026-10-30)");
  expect(filter).toContain("and(activity_date.is.null,started_at.gte.");
  expect(filter).toContain(`started_at.lt.${cairoDayStart("2026-10-31")}`);
  expect(historyDateFilter()).toBeNull();
});
