import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { targetInput } from "@/lib/numeric-input";

type Role = Database["public"]["Enums"]["app_role"];
export type TargetRow = Database["public"]["Tables"]["nutrition_targets"]["Row"];
export type TargetValues = ReturnType<typeof targetInput>;
export type MemberChange =
  | { kind: "access"; member: string; active: boolean }
  | { kind: "role"; member: string; role: Role; grant: boolean }
  | { kind: "coach"; member: string; coach: string };

/** Fresh UI preflight; database policies and the guarded coach RPC remain authoritative. */
export async function requireActiveAdmin(actor: string) {
  const [profile, roles] = await Promise.all([
    supabase.from("profiles").select("access_active").eq("id", actor).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", actor),
  ]);
  if (profile.error) throw profile.error;
  if (roles.error) throw roles.error;
  const names = roles.data.map((row) => row.role);
  if (!profile.data?.access_active || !names.some((r) => r === "admin" || r === "super_admin"))
    throw new Error("Active administrator access is required. Your draft is retained.");
  return names.includes("super_admin");
}

export async function saveMemberChange(actor: string, change: MemberChange) {
  const superAdmin = await requireActiveAdmin(actor);
  if (change.kind !== "coach") {
    if (change.member === actor)
      throw new Error("You cannot change your own access or roles here.");
    const roles = await supabase.from("user_roles").select("role").eq("user_id", change.member);
    if (roles.error) throw roles.error;
    if (roles.data.some((r) => r.role === "super_admin"))
      throw new Error("Super administrator access and roles are protected.");
    if (change.kind === "role") {
      if (!(
        change.role === "coach" ||
        change.role === "pod_leader" ||
        (superAdmin && change.role === "admin")
      ))
        throw new Error("You cannot manage this role.");
      if (roles.data.some((r) => r.role === change.role) === change.grant) return;
      const result = change.grant
        ? await supabase
            .from("user_roles")
            .insert({ user_id: change.member, role: change.role })
            .select("user_id")
            .single()
        : await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", change.member)
            .eq("role", change.role)
            .select("user_id")
            .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("Role change was not confirmed. Refresh and review again.");
      return;
    }
    const result = await supabase
      .from("profiles")
      .update({ access_active: change.active })
      .eq("id", change.member)
      .select("id")
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Access change was not confirmed. Refresh and review again.");
    return;
  }
  const result = await supabase.rpc("set_member_coach", {
    _member: change.member,
    ...(change.coach ? { _coach: change.coach } : {}),
  });
  if (result.error) throw result.error;
  const assigned = await supabase
    .from("coach_assignments")
    .select("coach_id")
    .eq("member_id", change.member)
    .eq("active", true)
    .maybeSingle();
  if (assigned.error) throw assigned.error;
  if ((assigned.data?.coach_id ?? "") !== change.coach)
    throw new Error("Coach change was not confirmed. Your selection is retained.");
}

const keys = ["calories", "protein_g", "carbs_g", "fat_g", "water_ml"] as const;
export function sameTargets(row: TargetRow | null, values: TargetValues) {
  return !!row && keys.every((key) => row[key] === values[key]);
}
export async function saveAdminTargets(
  actor: string,
  member: string,
  values: TargetValues,
  original: TargetRow | null,
) {
  await requireActiveAdmin(actor);
  // Validate at the operation boundary too; blank means unset, never an invented zero.
  targetInput(
    Object.fromEntries(
      keys.map((key) => [key, values[key] == null ? "" : String(values[key])]),
    ) as Parameters<typeof targetInput>[0],
  );
  const current = await supabase
    .from("nutrition_targets")
    .select("*")
    .eq("member_id", member)
    .maybeSingle();
  if (current.error) throw current.error;
  if (sameTargets(current.data, values)) return current.data!; // Reconcile a lost acknowledgement.
  if (
    (current.data?.updated_at ?? null) !== (original?.updated_at ?? null) ||
    keys.some((key) => (current.data?.[key] ?? null) !== (original?.[key] ?? null))
  )
    throw new Error(
      "Targets changed in another tab or session. Keep your draft, then reload and review the saved targets.",
    );
  const payload = { member_id: member, ...values, set_by: actor };
  let request;
  if (original) {
    let update = supabase
      .from("nutrition_targets")
      .update(payload)
      .eq("member_id", member)
      .eq("updated_at", original.updated_at);
    for (const key of keys)
      update = original[key] == null ? update.is(key, null) : update.eq(key, original[key]!);
    request = update.select("*").maybeSingle();
  } else request = supabase.from("nutrition_targets").insert(payload).select("*").single();
  const result = await request;
  if (result.error) throw result.error;
  if (!result.data || !sameTargets(result.data, values))
    throw new Error(
      "Targets were not confirmed. Your draft is retained; refresh and review before retrying.",
    );
  return result.data;
}
