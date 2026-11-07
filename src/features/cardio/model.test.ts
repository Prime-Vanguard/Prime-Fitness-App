import { expect, it } from "vitest";
import {
  cardioData,
  cardioPace,
  intervalPlan,
  intervalPosition,
  intervalTotal,
  timerElapsed,
} from "./model";
const plan = { prepare: 10, work: 30, rest: 20, rounds: 2 };
it("counts preparation and between-round rest without a final rest", () => {
  expect(intervalTotal(plan)).toBe(90);
  expect(intervalPosition(plan, 9)).toEqual({ phase: "prepare", round: 1, remaining: 1 });
  expect(intervalPosition(plan, 10)).toEqual({ phase: "work", round: 1, remaining: 30 });
  expect(intervalPosition(plan, 40)).toEqual({ phase: "rest", round: 1, remaining: 20 });
  expect(intervalPosition(plan, 60)).toEqual({ phase: "work", round: 2, remaining: 30 });
  expect(intervalPosition(plan, 90)).toEqual({ phase: "done", round: 2, remaining: 0 });
  expect(intervalPosition({ ...plan, rest: 0 }, 40).phase).toBe("work");
});
it("recovers wall time and excludes paused time, clamping completion", () => {
  const timer = {
    id: crypto.randomUUID(),
    plan,
    log_date: "2026-11-07",
    elapsed: 12,
    anchor: 1000,
    saved: false,
  };
  expect(timerElapsed(timer, 11000)).toBe(22);
  expect(timerElapsed({ ...timer, anchor: null }, 110000)).toBe(12);
  expect(timerElapsed(timer, 1000000)).toBe(90);
});
it("rejects invalid plans and separates pace from strength volume", () => {
  expect(intervalPlan.safeParse({ ...plan, work: 0 }).success).toBe(false);
  expect(intervalPlan.safeParse({ ...plan, rounds: 100, work: 3600 }).success).toBe(false);
  expect(
    cardioData.safeParse({
      activity: "hiit",
      log_date: "2026-11-07",
      duration_seconds: 91,
      intervals: plan,
    }).success,
  ).toBe(false);
  expect(cardioPace(300, 1000, "metric")).toEqual({ speed: 12, pace: "5:00" });
  expect(cardioPace(300, 1609.344, "imperial")).toEqual({ speed: 12, pace: "5:00" });
  expect(cardioPace(300, null, "metric")).toBeNull();
});
