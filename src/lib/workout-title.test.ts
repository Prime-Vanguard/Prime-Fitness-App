import { describe, expect, it } from "vitest";
import { workoutTitleSchema } from "./workout-title";

describe("workoutTitleSchema", () => {
  it("trims names and rejects blank or overlong ones", () => {
    expect(workoutTitleSchema.parse("  Push A  ")).toBe("Push A");
    expect(workoutTitleSchema.parse("دفع")).toBe("دفع");
    expect(workoutTitleSchema.safeParse("   ").success).toBe(false);
    expect(workoutTitleSchema.safeParse("x".repeat(81)).success).toBe(false);
  });
});
