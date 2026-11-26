import { describe, it, expect } from "vitest";
import { currentStreak, questCampaign, streakTier, weekStart, weeklyQuests } from "./streaks";

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

describe("weeklyQuests with server rewards", () => {
  const row = (quest: string, progress: number, goal: number, awarded = false, pays = true) => ({
    quest,
    progress,
    goal,
    xp: quest === "week" ? 750 : 250,
    awarded,
    pays,
  });
  const server = [
    row("workouts", 3, 3, true),
    row("nutrition", 2, 5),
    row("body", 0, 1),
    row("week", 1, 3),
  ];
  it("uses server goals and rewards, keeping pending local progress visible", () =>
    expect(weeklyQuests({ workouts: 1, foodDays: 4, bodyChecks: 1 }, server)).toEqual([
      { key: "q_workouts", progress: 3, goal: 3, xp: 250, awarded: true },
      { key: "q_nutrition", progress: 4, goal: 5, xp: 250, awarded: false },
      { key: "q_body", progress: 1, goal: 1, xp: 250, awarded: false },
    ]));
  it("shows no reward before quests start paying", () => {
    const early = server.map((r) => ({ ...r, pays: false }));
    expect(weeklyQuests({ workouts: 0, foodDays: 0, bodyChecks: 0 }, early)[0]!.xp).toBeUndefined();
    expect(questCampaign(early)).toBeUndefined();
  });
  it("reports the campaign bonus", () =>
    expect(questCampaign(server)).toEqual({ xp: 750, awarded: false }));
});

describe("streakTier", () => {
  it("steps at 1, 3, 7, 14 and 30 days", () => {
    expect([0, 1, 2, 3, 6, 7, 13, 14, 29, 30, 99].map(streakTier)).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    ]);
  });
});
