import "fake-indexeddb/auto";
import { assert, beforeEach, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { readMemberState } from "./member-store";
import { readOfflineIdentity } from "./offline-access";
import { loadStaffSummaryMember, verifyStaffDownloadAuthority } from "./staff-offline-access";
import {
  downloadOfflineTargets,
  markTargetDraftConfirmed,
  mergeTargetDraft,
  readOfflineTargets,
  removeOfflineTargets,
  revalidateOfflineTargets,
  saveOfflineTargetDraft,
  targetForm,
} from "./offline-target-drafts";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("./offline-access", () => ({ readOfflineIdentity: vi.fn() }));
vi.mock("./staff-offline-access", () => ({
  verifyStaffDownloadAuthority: vi.fn(),
  loadStaffSummaryMember: vi.fn(),
}));

let actor: string;
const memberId = crypto.randomUUID();
const baseline = { calories: 2200, protein_g: 150, carbs_g: null, fat_g: null, water_ml: 2500 };

beforeEach(() => {
  vi.resetAllMocks();
  actor = crypto.randomUUID();
  vi.mocked(readOfflineIdentity).mockReturnValue({ id: actor });
  vi.mocked(verifyStaffDownloadAuthority).mockResolvedValue({
    actor,
    admin: true,
    coach: false,
    podLeader: false,
    authorization: "Bearer fixture",
  });
  vi.mocked(loadStaffSummaryMember).mockResolvedValue({ id: memberId, display_name: "Member" });
  const query = {
    select: () => query,
    eq: () => query,
    setHeader: () => query,
    abortSignal: () => query,
    maybeSingle: async () => ({ data: { member_id: memberId, ...baseline }, error: null }),
  };
  vi.mocked(supabase.from).mockReturnValue(query as never);
});

it("keeps the saved draft through download retries and rejects stale edits and stale removal", async () => {
  await expect(downloadOfflineTargets(actor, memberId)).resolves.toBe("saved");
  const [snapshot] = await readOfflineTargets(actor);
  assert(snapshot);
  await saveOfflineTargetDraft(actor, snapshot, { ...targetForm(baseline), calories: "2400" });
  await expect(downloadOfflineTargets(actor, memberId)).resolves.toBe("has-draft");
  await expect(saveOfflineTargetDraft(actor, snapshot, targetForm(baseline))).rejects.toThrow(
    "changed in another tab",
  );
  await expect(removeOfflineTargets(actor, snapshot)).rejects.toThrow("changed in another tab");
  expect((await readOfflineTargets(actor))[0]?.draft?.calories).toBe(2400);
  expect((await readMemberState(actor)).references).toEqual({});
  vi.mocked(readOfflineIdentity).mockReturnValue({ id: memberId });
  expect(await readOfflineTargets(actor)).toEqual([]);
});

it("retains a saved copy on uncertain access and purges it after confirmed admin revocation", async () => {
  await downloadOfflineTargets(actor, memberId);
  vi.mocked(verifyStaffDownloadAuthority).mockRejectedValueOnce(new Error("Network unavailable"));
  await expect(revalidateOfflineTargets(actor)).rejects.toThrow("Network unavailable");
  expect(await readOfflineTargets(actor)).toHaveLength(1);
  vi.mocked(verifyStaffDownloadAuthority).mockResolvedValue({
    actor,
    admin: false,
    coach: true,
    podLeader: false,
    authorization: "Bearer fixture",
  });
  await expect(revalidateOfflineTargets(actor)).resolves.toEqual([]);
  expect(await readOfflineTargets(actor)).toEqual([]);
  await expect(downloadOfflineTargets(actor, memberId)).resolves.toBe("denied");
});

it("carries over only edited fields and flags competing edits for review", () => {
  const current = { ...baseline, calories: 2300, protein_g: 160 };
  expect(
    mergeTargetDraft(baseline, { ...baseline, calories: 2400, water_ml: null }, current),
  ).toEqual({
    form: { ...targetForm(current), calories: "2400", water_ml: "" },
    conflict: true,
  });
});

it("clears only the draft revision that was reviewed after the server accepts it", async () => {
  await downloadOfflineTargets(actor, memberId);
  const [download] = await readOfflineTargets(actor);
  assert(download);
  await saveOfflineTargetDraft(actor, download, { ...targetForm(baseline), calories: "2500" });
  const [edited] = await readOfflineTargets(actor);
  assert(edited);
  const accepted = { ...baseline, calories: 2400 };
  await markTargetDraftConfirmed(actor, memberId, download.revision, accepted);
  expect((await readOfflineTargets(actor))[0]).toEqual(edited);
  await markTargetDraftConfirmed(actor, memberId, edited.revision, accepted);
  expect((await readOfflineTargets(actor))[0]).toMatchObject({ draft: null, baseline: accepted });
});
