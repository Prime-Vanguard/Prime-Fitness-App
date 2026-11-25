import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { readOfflineIdentity } from "./offline-access";
import { readMemberState } from "./member-store";
import { changeStaffOfflineSummaries, readStaffOfflineSummaries } from "./staff-offline-store";

vi.mock("./offline-access", async (original) => ({
  ...(await original<typeof import("./offline-access")>()),
  readOfflineIdentity: vi.fn(),
}));

it("keeps saved staff summaries out of personal recovery and requires the same actor to read or change them", async () => {
  const actor = crypto.randomUUID(),
    memberId = crypto.randomUUID();
  vi.mocked(readOfflineIdentity).mockReturnValue({ id: actor });
  const row = {
    memberId,
    downloadedAt: "2026-11-18T10:00:00Z",
    from: "2026-11-16",
    to: "2026-11-18",
    displayName: "Member",
    lastWorkout: null,
    completedThisWeek: 0,
  };
  await changeStaffOfflineSummaries(actor, () => [row]);
  expect(await readStaffOfflineSummaries(actor)).toEqual([row]);
  expect((await readMemberState(actor)).references).toEqual({});
  vi.mocked(readOfflineIdentity).mockReturnValue({ id: memberId });
  expect(await readStaffOfflineSummaries(actor)).toEqual([]);
  await expect(changeStaffOfflineSummaries(actor, () => [])).rejects.toThrow("account changed");
  vi.mocked(readOfflineIdentity).mockReturnValue({ id: actor });
  expect(await readStaffOfflineSummaries(actor)).toEqual([row]);
});
