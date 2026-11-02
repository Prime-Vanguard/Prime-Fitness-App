import { describe, it, expect } from "vitest";
import { e1rm, personalRecords, dailyBest, recordDay } from "./records";

describe("records", () => {
  it("preserves imported activity dates in trends and record dates", () => {
    const set = {
      exercise_id: "a",
      reps: 5,
      weight_kg: 100,
      created_at: "2026-10-30T12:00:00Z",
      workout_sessions: { origin: "import", activity_date: "2026-10-20" },
    };
    expect(dailyBest([set], "a")).toEqual([{ date: "2026-10-20", value: 116.7 }]);
    expect(personalRecords([set]).get("a")?.date).toBe("2026-10-20");
  });
  it("uses Cairo dates when an imported date is absent or invalid", () => {
    const set = {
      created_at: "2026-10-30T23:00:00Z",
      workout_sessions: { origin: "import", activity_date: "2026-02-30" },
    };
    expect(recordDay(set)).toBe("2026-10-31");
  });
  it("Epley 1RM", () => {
    expect(e1rm(100, 10)).toBe(133.3);
    expect(e1rm(100, 1)).toBe(100);
  });
  it("PR picks highest estimated 1RM, ignores empty sets", () => {
    const pr = personalRecords([
      { exercise_id: "a", reps: 5, weight_kg: 100, created_at: "2026-01-01" },
      { exercise_id: "a", reps: 1, weight_kg: 110, created_at: "2026-01-02" },
      { exercise_id: "a", reps: 0, weight_kg: 300, created_at: "2026-01-03" },
    ]).get("a")!;
    expect(pr.bestWeight).toBe(100);
    expect(pr.best1rm).toBe(116.7);
  });
  it("daily best groups by day", () => {
    expect(
      dailyBest(
        [
          { exercise_id: "a", reps: 5, weight_kg: 60, created_at: "2026-01-02T10:00" },
          { exercise_id: "a", reps: 5, weight_kg: 90, created_at: "2026-01-02T11:00" },
          { exercise_id: "a", reps: 1, weight_kg: 50, created_at: "2026-01-01T09:00" },
        ],
        "a",
      ),
    ).toEqual([
      { date: "2026-01-01", value: 50 },
      { date: "2026-01-02", value: 105 },
    ]);
  });
});
