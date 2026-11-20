import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { changeMemberState, readMemberState, type MemberState } from "./member-store";
import { readOfflineIdentity, withConnectionTimeout } from "./offline-access";
import { saveOfflineProfile } from "./offline-profile-cache";
import {
  authorizeQueuedSync,
  clearQueuedSyncDelay,
  delayQueuedSync,
  queuedSyncAuthorization,
  isRetryableSyncFailure,
  SyncRequestError,
} from "./queued-sync-access";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
const settingsSchema = z.object({
  display_name: z.string().nullable(),
  units: z.string(),
  locale: z.string(),
  leaderboard_opt_in: z.boolean(),
});
export type ProfileSettings = z.infer<typeof settingsSchema>;
const settingsPatchSchema = z.object({
  display_name: z.string().max(100).nullable().optional(),
  units: z.enum(["metric", "imperial"]).optional(),
  locale: z.enum(["en", "ar"]).optional(),
  leaderboard_opt_in: z.boolean().optional(),
});
type SettingsPatch = Partial<ProfileSettings>;
const queueSchema = z.object({
  version: z.literal(1),
  entries: z.array(
    z.object({
      id: z.uuid(),
      baseline: settingsSchema,
      patch: settingsPatchSchema,
      status: z.enum(["pending", "conflict", "rejected"]),
    }),
  ),
});
type SettingsQueue = z.infer<typeof queueSchema>;
const settingsKeys = settingsSchema.keyof().options;
const queueKey = "profileSettingsQueue";

function readSettingsQueue(state: MemberState): SettingsQueue {
  return queueSchema.parse(state.references[queueKey] ?? { version: 1, entries: [] });
}

export function profileSettingsStatus(state: MemberState) {
  const queue = queueSchema.safeParse(state.references[queueKey]);
  if (!queue.success) return state.references[queueKey] ? "rejected" : undefined;
  return queue.data.entries[0]?.status;
}

export function changedProfileSettings(
  baseline: ProfileSettings,
  settings: ProfileSettings,
): SettingsPatch {
  return settingsPatchSchema.parse(
    Object.fromEntries(
      settingsKeys
        .filter((key) => baseline[key] !== settings[key])
        .map((key) => [key, settings[key]]),
    ),
  ) as SettingsPatch;
}

export async function overlayPendingProfileSettings(profile: Profile): Promise<Profile> {
  if (!profile.access_active) return profile;
  try {
    const { entries } = readSettingsQueue(await readMemberState(profile.id));
    // Stop at a conflicted or rejected entry: it will not be sent, and later
    // entries wait behind it, so none of them reflect a value that will be saved.
    const blocked = entries.findIndex(({ status }) => status !== "pending");
    const sendable = blocked < 0 ? entries : entries.slice(0, blocked);
    return Object.assign({ ...profile }, ...sendable.map(({ patch }) => patch));
  } catch {
    return profile;
  }
}

export async function queueProfileSettings(
  memberId: string,
  baseline: ProfileSettings,
  patch: SettingsPatch,
) {
  if (readOfflineIdentity()?.id !== memberId) throw new Error("Offline account unavailable");
  const entry = {
    id: crypto.randomUUID(),
    baseline: settingsSchema.parse(baseline),
    patch: settingsPatchSchema.parse(patch),
    status: "pending" as const,
  };
  await changeMemberState(memberId, (state) => {
    const queue = readSettingsQueue(state);
    if (queue.entries[0] && queue.entries[0].status !== "pending")
      throw new Error("Pending preferences need review");
    return writeSettingsQueue(state, { ...queue, entries: [...queue.entries, entry] });
  });
}

function writeSettingsQueue(state: MemberState, queue: SettingsQueue): MemberState {
  return {
    ...state,
    references: { ...state.references, [queueKey]: queue satisfies Json },
  };
}

const activeSyncs = new Map<string, Promise<boolean>>();

async function withSettingsLock<T>(memberId: string, run: () => Promise<T>): Promise<T> {
  const scope = `pf-profile-settings:${import.meta.env["VITE_SUPABASE_URL"]}:${memberId}`;
  return navigator.locks ? await navigator.locks.request(scope, run) : run();
}

export function syncProfileSettings(memberId: string): Promise<boolean> {
  const active = activeSyncs.get(memberId);
  if (active) return active;
  const sync = withSettingsLock(memberId, () => flushProfileSettings(memberId))
    .catch((error: unknown) => {
      if (!isRetryableSyncFailure(error)) throw error;
      delayQueuedSync(memberId, "preferences");
      return false;
    })
    .finally(() => activeSyncs.delete(memberId));
  activeSyncs.set(memberId, sync);
  return sync;
}

async function flushProfileSettings(memberId: string): Promise<boolean> {
  if (!navigator.onLine || readOfflineIdentity()?.id !== memberId) return false;
  const initial = readSettingsQueue(await readMemberState(memberId)).entries[0];
  if (!initial || initial.status !== "pending") return false;
  if (!(await authorizeQueuedSync(memberId, "preferences"))) return false;
  const entry = readSettingsQueue(await readMemberState(memberId)).entries[0];
  if (!entry || entry.status !== "pending") return false;
  const current = await withConnectionTimeout(
    supabase.from("profiles").select("*").eq("id", memberId).maybeSingle(),
  );
  if (current.error) throw new SyncRequestError(current.error, current.status);
  if (!current.data?.access_active || current.data.id !== memberId) return false;
  let serverProfile = current.data;
  const fields = settingsKeys.filter((key) => entry.patch[key] !== undefined);
  if (
    fields.some(
      (key) =>
        serverProfile[key] !== entry.baseline[key] && serverProfile[key] !== entry.patch[key],
    )
  ) {
    clearQueuedSyncDelay(memberId, "preferences");
    await saveOfflineProfile(memberId, serverProfile);
    await settleProfileSettings(memberId, entry.id, "conflict");
    return true;
  }
  // A response can be lost after the write. Matching intended values acknowledge that retry.
  if (fields.some((key) => serverProfile[key] !== entry.patch[key])) {
    const authorization = await queuedSyncAuthorization(memberId);
    if (!authorization) return false;
    const update = await supabase
      .from("profiles")
      .update(entry.patch as SettingsPatch)
      .eq("id", memberId)
      .eq("access_active", true)
      .eq("updated_at", serverProfile.updated_at)
      .select("*")
      .setHeader("Authorization", authorization)
      .abortSignal(AbortSignal.timeout(5000))
      .maybeSingle();
    if (update.error) {
      if ([400, 403, 409, 422].includes(update.status)) {
        await settleProfileSettings(memberId, entry.id, "rejected");
        return true;
      }
      throw new SyncRequestError(update.error, update.status);
    }
    // Another write won the comparison. Re-read before deciding whether it conflicts.
    if (!update.data || update.data.id !== memberId) return false;
    serverProfile = update.data;
  }
  clearQueuedSyncDelay(memberId, "preferences");
  if (!(await saveOfflineProfile(memberId, serverProfile))) return false;
  await settleProfileSettings(memberId, entry.id, "accepted");
  return true;
}

async function settleProfileSettings(
  memberId: string,
  entryId: string,
  result: "accepted" | "conflict" | "rejected",
) {
  await changeMemberState(memberId, (state) => {
    const queue = readSettingsQueue(state);
    const [head, ...remaining] = queue.entries;
    if (head?.id !== entryId) return state;
    const entries = result === "accepted" ? remaining : [{ ...head, status: result }, ...remaining];
    return writeSettingsQueue(state, { ...queue, entries });
  });
}

export async function discardBlockedProfileSettings(memberId: string) {
  await withSettingsLock(memberId, () =>
    changeMemberState(memberId, (state) => {
      const status = profileSettingsStatus(state);
      if (status !== "conflict" && status !== "rejected") return state;
      // Later edits may depend on the blocked entry's values, so discard them together.
      return writeSettingsQueue(state, { version: 1, entries: [] });
    }),
  );
}
