import { describe, expect, it } from "vitest";
import { nextSupersetExercise, plateLoad, warmupSets } from "./training-tools";
describe("training calculations", () => {
  it("balances a 100kg load around a 20kg bar", () => {
    expect(plateLoad(100)).toEqual({ plates: [20, 20], total: 100, remainder: 0 });
    expect(plateLoad(100, 20, [25, 15])?.plates).toEqual([25, 15]);
    expect(plateLoad(100, 20, [25, 20])?.plates).toEqual([20, 20]);
  });
  it("reports unachievable loads rather than silently claiming an exact load", () => {
    expect(plateLoad(101)?.remainder).toBe(1);
    expect(plateLoad(19)).toBeNull();
    expect(plateLoad(NaN)).toBeNull();
  });
  it("generates progressive plate-loadable warmups below the working set", () => {
    expect(warmupSets(100)).toEqual([
      { weight: 20, reps: 10 },
      { weight: 50, reps: 5 },
      { weight: 70, reps: 3 },
      { weight: 90, reps: 1 },
    ]);
    expect(warmupSets(22.5)).toEqual([{ weight: 20, reps: 10 }]);
    expect(warmupSets(20)).toEqual([]);
  });
  it("starts shared rest only after the second exercise", () => {
    expect(nextSupersetExercise("a", ["a", "b"])).toEqual({ next: "b", rest: false });
    expect(nextSupersetExercise("b", ["a", "b"])).toEqual({ next: "a", rest: true });
  });
});
