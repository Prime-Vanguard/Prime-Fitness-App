import { describe, expect, it } from "vitest";
import {
  debriefRecord,
  enqueue,
  nextToPlay,
  rememberStartXp,
  updateDebrief,
  type Celebration,
} from "./celebrate";

const add = (...events: Celebration[]) => events.reduce(enqueue, [] as Celebration[]);

describe("celebration queue", () => {
  it("plays in priority order: rank, level, badge, quest, streak, xp", () => {
    const q = add(
      { kind: "xp", amount: 50 },
      { kind: "badge", code: "first_workout", title: "First Rep" },
      { kind: "streak", days: 7 },
      { kind: "quest", key: "q_workouts" },
      { kind: "level", level: 4, from: 3 },
    );
    expect(q.map((e) => e.kind)).toEqual(["level", "badge", "quest", "streak", "xp"]);
  });
  it("merges duplicates: XP adds up, levels keep the highest, a rank absorbs the level", () => {
    expect(add({ kind: "xp", amount: 50 }, { kind: "xp", amount: 25 })).toEqual([
      { kind: "xp", amount: 75 },
    ]);
    expect(add({ kind: "level", level: 4, from: 3 }, { kind: "level", level: 5, from: 3 })).toEqual(
      [{ kind: "level", level: 5, from: 3 }],
    );
    expect(
      add(
        { kind: "rank", level: 16, rank: "Seeker", from: 15 },
        { kind: "level", level: 17, from: 3 },
      ),
    ).toEqual([{ kind: "rank", level: 17, rank: "Seeker", from: 3 }]);
    const badge = { kind: "badge", code: "food_30", title: "Discipline" } as const;
    expect(add(badge, badge)).toHaveLength(1);
    expect(add(badge, { ...badge, code: "first_food" })).toHaveLength(2);
  });
  it("holds big moments during a workout and lets small ones through", () => {
    const q = add({ kind: "level", level: 4, from: 3 }, { kind: "xp", amount: 50 });
    expect(nextToPlay(q, false)).toEqual({ kind: "level", level: 4, from: 3 });
    expect(nextToPlay(q, true)).toEqual({ kind: "xp", amount: 50 });
    expect(nextToPlay(add({ kind: "level", level: 4, from: 3 }), true)).toBeUndefined();
  });
  it("holds every moment while a page moment has the stage", () => {
    const q = add({ kind: "level", level: 4, from: 3 }, { kind: "xp", amount: 50 });
    expect(nextToPlay(q, false, true)).toBeUndefined();
    expect(nextToPlay(q, true, true)).toBeUndefined();
  });
});

describe("workout debrief record", () => {
  it("keeps the first start XP, freezes the gain and replaces the previous workout", () => {
    rememberStartXp("a", 300);
    rememberStartXp("a", 3800);
    updateDebrief("a", { gain: 3500, shown: true });
    expect(debriefRecord("a")).toEqual({ id: "a", start: 300, gain: 3500, shown: true });
    rememberStartXp("b", 3800);
    expect(debriefRecord("a")).toBeNull();
    expect(debriefRecord("b")).toEqual({ id: "b", start: 3800 });
  });
});
