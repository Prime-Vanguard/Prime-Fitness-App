import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { changeMemberState } from "./member-store";
import { loadAssignedTraining } from "./training-assignment";

afterEach(() => vi.restoreAllMocks());
it("distinguishes an undownloaded program from a verified absence of an assignment", async () => {
  const memberId = crypto.randomUUID();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  await expect(loadAssignedTraining(memberId)).rejects.toThrow("download");
  await changeMemberState(memberId, (state) => ({
    ...state,
    references: {
      assignedTraining: {
        version: 1,
        memberId,
        savedAt: new Date().toISOString(),
        assignment: null,
      },
    },
  }));
  await expect(loadAssignedTraining(memberId)).resolves.toBeNull();
  await expect(loadAssignedTraining(memberId, true)).rejects.toThrow("Connect");
});
it("restores a frozen program and rejects foreign schedule ownership", async () => {
  const memberId = crypto.randomUUID();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  const assignment = {
    assignmentId: "assignment",
    version: { id: "frozen-version", name: "Frozen block", weeks: 4, version: 2, items: [] },
    schedule: null,
    occurrences: [],
  };
  await changeMemberState(memberId, (state) => ({
    ...state,
    references: {
      assignedTraining: { version: 1, memberId, savedAt: new Date().toISOString(), assignment },
    },
  }));
  expect((await loadAssignedTraining(memberId))?.version.name).toBe("Frozen block");
  await changeMemberState(memberId, (state) => ({
    ...state,
    references: {
      assignedTraining: {
        version: 1,
        memberId,
        savedAt: new Date().toISOString(),
        assignment: {
          ...assignment,
          schedule: {
            member_id: "other",
            assignment_id: "assignment",
            mode: "rotation",
            start_date: "2026-01-01",
          },
        },
      },
    },
  }));
  await expect(loadAssignedTraining(memberId)).rejects.toThrow("ownership");
});
