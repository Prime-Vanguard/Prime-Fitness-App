import { describe, expect, it } from "vitest";
import { workoutSyncState } from "./workout-sync-state";

describe("workout sync presentation", () => {
  it("prioritizes errors and never infers sending from pending writes", () => {
    expect(workoutSyncState(true, 1, true)).toBe("attention");
    expect(workoutSyncState(true, 0, true)).toBe("attention");
    expect(workoutSyncState(true, 1, false)).toBe("pending");
    expect(workoutSyncState(false, 1, false)).toBe("pending");
    expect(workoutSyncState(false, 0, false)).toBe("offline");
    expect(workoutSyncState(true, 0, false)).toBe("synced");
  });
});
