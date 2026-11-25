import { z } from "zod";
import { changeMemberState, readMemberState } from "./member-store";
import { readOfflineIdentity } from "./offline-access";

export const STAFF_DOWNLOAD_LIMIT = 20;
export const staffSummarySchema = z.object({
  memberId: z.uuid(),
  displayName: z.string().nullable(),
  downloadedAt: z.iso.datetime(),
  from: z.iso.date(),
  to: z.iso.date(),
  lastWorkout: z.iso.date().nullable(),
  completedThisWeek: z.number().int().nonnegative(),
});
export type StaffOfflineSummary = z.infer<typeof staffSummarySchema>;
const snapshotSchema = z.object({
  version: z.literal(1),
  actorId: z.uuid(),
  summaries: z.array(staffSummarySchema).max(STAFF_DOWNLOAD_LIMIT),
});
export const staffStorageOwner = (actor: string) => `staff-offline:${z.uuid().parse(actor)}`;

function parseSummaries(actor: string, value: unknown): StaffOfflineSummary[] {
  if (value === undefined) return [];
  const snapshot = snapshotSchema.parse(value);
  if (snapshot.actorId !== actor)
    throw new Error("Saved staff summaries belong to another account.");
  return snapshot.summaries;
}

// Separate device keys keep staff downloads out of personal recovery and backup exports.
export async function readStaffOfflineSummaries(actor: string) {
  if (readOfflineIdentity()?.id !== actor) return [];
  const stored = await readMemberState(staffStorageOwner(actor));
  if (readOfflineIdentity()?.id !== actor) return [];
  return parseSummaries(actor, stored.references["staffSummaries"]);
}

export async function changeStaffOfflineSummaries(
  actor: string,
  change: (summaries: StaffOfflineSummary[]) => StaffOfflineSummary[],
) {
  await changeMemberState(staffStorageOwner(actor), (state) => {
    if (readOfflineIdentity()?.id !== actor) throw new Error("The signed-in account changed.");
    const summaries = change(parseSummaries(actor, state.references["staffSummaries"]));
    const snapshot = snapshotSchema.parse({ version: 1, actorId: actor, summaries });
    return { ...state, references: { ...state.references, staffSummaries: snapshot } };
  });
}
