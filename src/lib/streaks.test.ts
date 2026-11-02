import { describe, it, expect } from "vitest";
import { currentStreak, weekStart, weeklyQuests } from "./streaks";

describe("streaks", () => {
  it("counts consecutive days through today", () =>
    expect(currentStreak(["2026-10-22", "2026-10-23", "2026-10-24"], "2026-10-24")).toBe(3));
  it("keeps yesterday's streak alive before today is logged", () =>
    expect(currentStreak(["2026-10-22", "2026-10-23"], "2026-10-24")).toBe(2));
  it("breaks on a missed day", () =>
    expect(currentStreak(["2026-10-21", "2026-10-24"], "2026-10-24")).toBe(1));
  it("week starts Monday", () => expect(weekStart("2026-10-24")).toBe("2026-10-19"));
  it("quests cap at goal", () =>
    expect(
      weeklyQuests({ workouts: 5, foodDays: 2, bodyChecks: 0 }).map((q) => q.progress),
    ).toEqual([3, 2, 0]));
});
