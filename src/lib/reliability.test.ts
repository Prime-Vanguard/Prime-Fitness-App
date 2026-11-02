import { describe, expect, it, vi } from "vitest";
import { fetchAll } from "./pagination";
import { personalRecords } from "./records";
import { currentStreak, weekStart } from "./streaks";
import { displayLength, displayWeight, storedLength, storedWeight } from "./units";
import { plateLoad, warmupSets } from "./training-tools";

describe("complete history and display units", () => {
  it("includes the newest PR beyond 1000 rows even with a smaller server cap", async () => {
    const all = Array.from({ length: 1105 }, (_, i) => ({
      id: String(i),
      exercise_id: "bench",
      reps: 5,
      weight_kg: i === 1104 ? 150 : 80,
      created_at: new Date(2026, 0, 1, 0, i).toISOString(),
    }));
    const rows = await fetchAll(
      async (from) => ({ data: all.slice(from, from + 100), error: null }),
      (r) => r.id,
    );
    expect(rows).toHaveLength(1105);
    expect(personalRecords(rows).get("bench")?.bestWeight).toBe(150);
  });
  it("rejects an incomplete history on a failed page", async () => {
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "one" }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Connection failed" } });
    await expect(fetchAll(page, (r: { id: string }) => r.id)).rejects.toThrow("Connection failed");
  });
  it("detects a server that ignores pagination", async () => {
    await expect(
      fetchAll(
        async () => ({ data: [{ id: "same" }], error: null }),
        (r) => r.id,
      ),
    ).rejects.toThrow("did not advance");
  });
  it("retains streaks longer than 60 days across month boundaries", () => {
    const days = Array.from({ length: 120 }, (_, i) =>
      new Date(Date.UTC(2026, 9, 25 - i)).toISOString().slice(0, 10),
    );
    expect(currentStreak(days, "2026-10-25")).toBe(120);
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
    expect(weekStart("2026-01-01")).toBe("2025-12-29");
  });
  it("round trips imperial input to canonical kg and cm", () => {
    expect(storedWeight(225, "imperial")).toBe(102.06);
    expect(displayWeight(100, "imperial")).toBeCloseTo(220.462, 2);
    expect(storedWeight(displayWeight(100, "imperial"), "imperial")).toBe(100);
    expect(storedLength(34, "imperial")).toBe(86.36);
    expect(displayLength(86.36, "imperial")).toBeCloseTo(34);
    expect(storedWeight(100, "metric")).toBe(100);
  });
  it("uses real imperial plate increments and warmups", () => {
    expect(plateLoad(225, 45, [45, 35, 25, 10, 5, 2.5])?.plates).toEqual([45, 45]);
    expect(warmupSets(225, 45, 5).map((s) => s.weight)).toEqual([45, 110, 155, 200]);
  });
});
