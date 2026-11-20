import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { readOfflineIdentity } from "./offline-access";
import { changeMemberState, readMemberState } from "./member-store";
import { staffStorageOwner, STAFF_DOWNLOAD_LIMIT } from "./staff-offline-store";
import { loadStaffSummaryMember, verifyStaffDownloadAuthority } from "./staff-offline-access";
import { targetInput } from "./numeric-input";

const wholeNumber = z.number().int().nullable();
const targetValues = z.object({
  calories: wholeNumber,
  protein_g: wholeNumber,
  carbs_g: wholeNumber,
  fat_g: wholeNumber,
  water_ml: wholeNumber,
});
export const targetKeys = targetValues.keyof().options;
type TargetValues = z.infer<typeof targetValues>;
export type TargetForm = Record<keyof TargetValues, string>;

export function targetForm(values: TargetValues | null): TargetForm {
  return {
    calories: String(values?.calories ?? ""),
    protein_g: String(values?.protein_g ?? ""),
    carbs_g: String(values?.carbs_g ?? ""),
    fat_g: String(values?.fat_g ?? ""),
    water_ml: String(values?.water_ml ?? ""),
  };
}

const targetSnapshot = z.object({
  memberId: z.uuid(),
  displayName: z.string().nullable(),
  revision: z.uuid(),
  baseline: targetValues.nullable(),
  draft: targetValues.nullable(),
});
const deviceTargets = z.object({
  version: z.literal(1),
  actorId: z.uuid(),
  targets: z.array(targetSnapshot).max(STAFF_DOWNLOAD_LIMIT),
});
export type OfflineTarget = z.infer<typeof targetSnapshot>;

function parseTargets(actor: string, stored: unknown) {
  if (stored === undefined) return [];
  const device = deviceTargets.parse(stored);
  if (device.actorId !== actor) throw new Error("Saved targets belong to another account.");
  return device.targets;
}

export async function readOfflineTargets(actor: string) {
  if (readOfflineIdentity()?.id !== actor) return [];
  const state = await readMemberState(staffStorageOwner(actor));
  if (readOfflineIdentity()?.id !== actor) return [];
  return parseTargets(actor, state.references["offlineTargets"]);
}

async function changeOfflineTargets(
  actor: string,
  change: (rows: OfflineTarget[]) => OfflineTarget[],
) {
  await changeMemberState(staffStorageOwner(actor), (state) => {
    if (readOfflineIdentity()?.id !== actor) throw new Error("The signed-in account changed.");
    const targets = change(parseTargets(actor, state.references["offlineTargets"]));
    const updated = deviceTargets.parse({ version: 1, actorId: actor, targets });
    return { ...state, references: { ...state.references, offlineTargets: updated } };
  });
}

export async function downloadOfflineTargets(actor: string, memberId: string) {
  const authority = await verifyStaffDownloadAuthority(actor);
  if (!authority?.admin || !(await loadStaffSummaryMember(authority, memberId))) return "denied";
  const current = await supabase
    .from("nutrition_targets")
    .select("member_id,calories,protein_g,carbs_g,fat_g,water_ml")
    .eq("member_id", memberId)
    .setHeader("Authorization", authority.authorization)
    .abortSignal(AbortSignal.timeout(10000))
    .maybeSingle();
  if (current.error) throw current.error;
  if (current.data && current.data.member_id !== memberId)
    throw new Error("The returned targets belong to another member.");
  const freshAuthority = await verifyStaffDownloadAuthority(actor);
  const member = freshAuthority?.admin && (await loadStaffSummaryMember(freshAuthority, memberId));
  if (!member) return "denied";

  let result: "saved" | "full" | "has-draft" = "saved";
  const baseline = current.data ? targetValues.parse(current.data) : null;
  await changeOfflineTargets(actor, (rows) => {
    if (rows.some((row) => row.memberId === memberId && row.draft)) {
      result = "has-draft";
      return rows;
    }
    const retained = rows.filter((row) => row.memberId !== memberId);
    if (retained.length >= STAFF_DOWNLOAD_LIMIT) {
      result = "full";
      return rows;
    }
    return [
      ...retained,
      {
        memberId,
        displayName: member.display_name,
        baseline,
        draft: null,
        revision: crypto.randomUUID(),
      },
    ];
  });
  return result;
}

// A tab editing an older copy must not overwrite a newer draft or recreate a removed download.
export async function saveOfflineTargetDraft(
  actor: string,
  snapshot: OfflineTarget,
  form: TargetForm,
) {
  const draft = targetInput(form);
  const revision = crypto.randomUUID();
  await changeOfflineTargets(actor, (rows) => {
    if (
      !rows.some((row) => row.memberId === snapshot.memberId && row.revision === snapshot.revision)
    )
      throw new Error("The saved copy changed in another tab.");
    return rows.map((row) =>
      row.memberId === snapshot.memberId ? { ...row, draft, revision } : row,
    );
  });
}

export async function removeOfflineTargets(actor: string, snapshot: OfflineTarget) {
  await changeOfflineTargets(actor, (rows) => {
    const current = rows.find((row) => row.memberId === snapshot.memberId);
    if (current && current.revision !== snapshot.revision)
      throw new Error("The saved copy changed in another tab.");
    return rows.filter((row) => row.memberId !== snapshot.memberId);
  });
}

export async function markTargetDraftConfirmed(
  actor: string,
  memberId: string,
  reviewedRevision: string,
  accepted: TargetValues,
) {
  const baseline = targetValues.parse(accepted);
  await changeOfflineTargets(actor, (rows) =>
    rows.map((row) =>
      row.memberId === memberId && row.revision === reviewedRevision
        ? { ...row, baseline, draft: null, revision: crypto.randomUUID() }
        : row,
    ),
  );
}

export function mergeTargetDraft(
  downloaded: TargetValues | null,
  draft: TargetValues,
  current: TargetValues | null,
) {
  const form = targetForm(current);
  let conflict = false;
  for (const key of targetKeys) {
    const originalValue = downloaded?.[key] ?? null;
    const currentValue = current?.[key] ?? null;
    if (draft[key] === originalValue) continue;
    if (currentValue !== originalValue && currentValue !== draft[key]) conflict = true;
    form[key] = String(draft[key] ?? "");
  }
  return { form, conflict };
}

export async function loadOfflineTargetForReview(actor: string, memberId: string) {
  if (!navigator.onLine) throw new Error("Reconnect to review the draft.");
  const saved = (await revalidateOfflineTargets(actor)).find((row) => row.memberId === memberId);
  if (!saved?.draft) return null;
  const authority = await verifyStaffDownloadAuthority(actor);
  if (!authority?.admin || !(await loadStaffSummaryMember(authority, memberId)))
    throw new Error("Administrator access is required.");
  const current = await supabase
    .from("nutrition_targets")
    .select("*")
    .eq("member_id", memberId)
    .setHeader("Authorization", authority.authorization)
    .abortSignal(AbortSignal.timeout(10000))
    .maybeSingle();
  if (current.error) throw current.error;
  if (readOfflineIdentity()?.id !== actor || (current.data && current.data.member_id !== memberId))
    throw new Error("The signed-in account or member changed.");
  return {
    ...mergeTargetDraft(saved.baseline, saved.draft, current.data),
    baseline: current.data,
    revision: saved.revision,
  };
}

const checks = new Map<string, Promise<OfflineTarget[]>>();
export function revalidateOfflineTargets(actor: string) {
  const pending = checks.get(actor);
  if (pending) return pending;
  const check = checkOfflineTargets(actor).finally(() => checks.delete(actor));
  checks.set(actor, check);
  return check;
}

async function checkOfflineTargets(actor: string) {
  const saved = await readOfflineTargets(actor);
  if (!saved.length) return saved;
  const authority = await verifyStaffDownloadAuthority(actor);
  const accessibleMembers = new Set<string>();
  if (authority?.admin) {
    const profiles = await supabase
      .from("profiles")
      .select("id")
      .in(
        "id",
        saved.map(({ memberId }) => memberId),
      )
      .setHeader("Authorization", authority.authorization)
      .abortSignal(AbortSignal.timeout(10000));
    if (profiles.error) throw profiles.error;
    profiles.data.forEach(({ id }) => accessibleMembers.add(id));
  }
  const denied = new Set(
    saved.filter((row) => !accessibleMembers.has(row.memberId)).map((row) => row.memberId),
  );
  if (denied.size) {
    // Revisions protect edits, while a confirmed revocation also applies to drafts edited during this check.
    await changeOfflineTargets(actor, (rows) => rows.filter((row) => !denied.has(row.memberId)));
  }
  return (await readOfflineTargets(actor)).filter((row) => accessibleMembers.has(row.memberId));
}
