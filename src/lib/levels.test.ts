import { describe, it, expect } from "vitest";
import { levelFor, rankFor } from "./levels";

describe("ranks", () => {
  it("bands", () => {
    expect(rankFor(15).key).toBe("Recruit");
    expect(rankFor(16).key).toBe("Seeker");
    expect(rankFor(55).key).toBe("Forged");
    expect(rankFor(56).key).toBe("Guardian");
    expect(rankFor(90).key).toBe("Vanguard");
    expect(rankFor(91).key).toBe("Prime Legend");
    expect(rankFor(100).key).toBe("Prime Legend");
  });
  it("level from xp", () => {
    const th = [
      { level: 1, xp_required: 0 },
      { level: 2, xp_required: 100 },
      { level: 3, xp_required: 283 },
    ];
    expect(levelFor(0, th).level).toBe(1);
    expect(levelFor(150, th).level).toBe(2);
    expect(levelFor(999, th).next).toBeNull();
  });
});
