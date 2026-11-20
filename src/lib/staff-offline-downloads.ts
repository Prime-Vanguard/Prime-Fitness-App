import { activityDay } from "./dates";
import { weekStart } from "./streaks";
import { loadRosterWorkoutActivity } from "./coach-roster";
import { loadStaffSummaryMember, verifyStaffDownloadAuthority } from "./staff-offline-access";
import {
  changeStaffOfflineSummaries,
  readStaffOfflineSummaries,
  STAFF_DOWNLOAD_LIMIT,
  staffSummarySchema,
  type StaffOfflineSummary,
} from "./staff-offline-store";

export type StaffDownloadResult = "saved" | "denied" | "full";

export async function downloadStaffSummary(
  actor: string,
  memberId: string,
): Promise<StaffDownloadResult> {
  const stored = await readStaffOfflineSummaries(actor);
  const previous = stored.find((row) => row.memberId === memberId);
  const deny = async (): Promise<StaffDownloadResult> => {
    if (previous)
      await changeStaffOfflineSummaries(actor, (rows) =>
        rows.filter(
          (row) => row.memberId !== memberId || row.downloadedAt !== previous.downloadedAt,
        ),
      );
    return "denied";
  };
  const authority = await verifyStaffDownloadAuthority(actor);
  const member = authority && (await loadStaffSummaryMember(authority, memberId));
  if (!authority || !member) return deny();
  if (stored.length >= STAFF_DOWNLOAD_LIMIT && !stored.some((row) => row.memberId === memberId))
    return "full";
  const today = activityDay();
  const activity = await loadRosterWorkoutActivity(
    memberId,
    today,
    AbortSignal.timeout(15000),
    authority.authorization,
  );
  // Recheck after the reads so an assignment revoked during the download cannot be saved.
  const currentAuthority = await verifyStaffDownloadAuthority(actor);
  const currentMember =
    currentAuthority && (await loadStaffSummaryMember(currentAuthority, memberId));
  if (!currentMember) return deny();
  const summary = staffSummarySchema.parse({
    memberId,
    displayName: currentMember.display_name,
    from: weekStart(today),
    to: today,
    downloadedAt: new Date().toISOString(),
    lastWorkout: activity.last,
    completedThisWeek: activity.week,
  });
  let result: StaffDownloadResult = "full";
  await changeStaffOfflineSummaries(actor, (rows) => {
    const retained = rows.filter((row) => row.memberId !== memberId);
    if (retained.length >= STAFF_DOWNLOAD_LIMIT) return rows;
    result = "saved";
    return [...retained, summary];
  });
  return result;
}

const accessChecks = new Map<string, Promise<StaffOfflineSummary[]>>();
export function revalidateStaffSummaries(actor: string) {
  const active = accessChecks.get(actor);
  if (active) return active;
  const check = checkSavedAccess(actor).finally(() => accessChecks.delete(actor));
  accessChecks.set(actor, check);
  return check;
}

async function checkSavedAccess(actor: string) {
  const saved = await readStaffOfflineSummaries(actor);
  if (!saved.length) return saved;
  const authority = await verifyStaffDownloadAuthority(actor);
  const denied = new Set<string>();
  let failed = false;
  for (let offset = 0; offset < saved.length; offset += 4) {
    const batch = saved.slice(offset, offset + 4);
    await Promise.all(
      batch.map(async (row) => {
        try {
          if (!authority || !(await loadStaffSummaryMember(authority, row.memberId)))
            denied.add(row.memberId);
        } catch {
          failed = true;
        }
      }),
    );
  }
  if (denied.size) {
    const reviewed = new Map(saved.map((row) => [row.memberId, row.downloadedAt]));
    await changeStaffOfflineSummaries(actor, (rows) =>
      rows.filter(
        (row) => !denied.has(row.memberId) || reviewed.get(row.memberId) !== row.downloadedAt,
      ),
    );
  }
  if (failed) throw new Error("Some downloaded summaries could not be verified.");
  return saved.filter((row) => !denied.has(row.memberId));
}
