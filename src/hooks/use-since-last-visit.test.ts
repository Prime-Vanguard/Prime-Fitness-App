import { describe, expect, it } from "vitest";
import { changesSince, savedValues } from "./use-since-last-visit";

describe("changesSince", () => {
  it("reports nothing on the first visit", () => {
    expect(changesSince(null, [["a", 1]])).toEqual({ changed: new Map(), fresh: true });
  });
  it("reports new and changed ids with their earlier value", () => {
    const { changed, fresh } = changesSince({ a: 1, b: "pending" }, [
      ["a", 3],
      ["b", "approved"],
      ["c", 2],
      ["d", 4],
    ]);
    expect(fresh).toBe(false);
    expect([...changed]).toEqual([
      ["a", 1],
      ["b", "pending"],
      ["c", undefined],
      ["d", undefined],
    ]);
    expect(changesSince({ a: 1 }, [["a", 1]]).changed.size).toBe(0);
  });
});

describe("savedValues", () => {
  it("returns values only for the same scope", () => {
    const saved = { scope: "2026-11-23", values: { a: 1 } };
    expect(savedValues(saved, "2026-11-23")).toEqual({ a: 1 });
    expect(savedValues(saved, "2026-11-30")).toBeNull();
    expect(savedValues({ a: 1 }, "")).toBeNull();
    expect(savedValues(null, "")).toBeNull();
  });
});
