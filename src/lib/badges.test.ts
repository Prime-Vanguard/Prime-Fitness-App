import { describe, expect, it } from "vitest";
import { badgeProgress } from "./badges";

describe("badgeProgress", () => {
  const credits = new Map([
    ["workout", 12],
    ["nutrition_day", 4],
  ]);

  it("counts credits of the badge's kind toward its goal", () => {
    expect(badgeProgress("workouts_50", credits)).toEqual({ done: 12, goal: 50 });
    expect(badgeProgress("food_30", credits)).toEqual({ done: 4, goal: 30 });
  });

  it("caps at the goal and starts at zero without credits", () => {
    expect(badgeProgress("workouts_10", credits)).toEqual({ done: 10, goal: 10 });
    expect(badgeProgress("workouts_100", new Map())).toEqual({ done: 0, goal: 100 });
  });

  it("has no progress for one-step badges", () => {
    expect(badgeProgress("first_workout", credits)).toBeNull();
  });
});
