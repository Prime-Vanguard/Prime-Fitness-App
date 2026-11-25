import { supabase } from "@/integrations/supabase/client";
import { readOfflineIdentity, withConnectionTimeout } from "./offline-access";
import { queuedSyncAuthorization } from "./queued-sync-access";

export async function verifyStaffDownloadAuthority(actor: string) {
  if (!navigator.onLine || readOfflineIdentity()?.id !== actor)
    throw new Error("Connect with the same staff account to verify access.");
  const { data, error } = await withConnectionTimeout(supabase.auth.getUser());
  if (error) throw error;
  if (data.user?.id !== actor) throw new Error("The signed-in account changed.");
  const authorization = await queuedSyncAuthorization(actor);
  if (!authorization) throw new Error("The staff session could not be verified.");

  const signal = AbortSignal.timeout(10000);
  const [profile, roles] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,access_active")
      .eq("id", actor)
      .setHeader("Authorization", authorization)
      .abortSignal(signal)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", actor)
      .setHeader("Authorization", authorization)
      .abortSignal(signal),
  ]);
  if (profile.error) throw profile.error;
  if (roles.error) throw roles.error;
  if (profile.data?.id !== actor || !profile.data.access_active) return null;
  const names = new Set(roles.data.map(({ role }) => role));
  const admin = names.has("admin") || names.has("super_admin");
  const coach = names.has("coach");
  const podLeader = names.has("pod_leader");
  if (!admin && !coach && !podLeader) return null;
  return { actor, authorization, admin, coach, podLeader };
}

type StaffAuthority = NonNullable<Awaited<ReturnType<typeof verifyStaffDownloadAuthority>>>;

export async function loadStaffSummaryMember(authority: StaffAuthority, memberId: string) {
  const { actor, authorization, admin, coach, podLeader } = authority;
  if (actor === memberId) return null;
  const signal = AbortSignal.timeout(10000);
  let assigned = admin;
  if (!assigned && coach) {
    const assignment = await supabase
      .from("coach_assignments")
      .select("member_id")
      .eq("coach_id", actor)
      .eq("member_id", memberId)
      .eq("active", true)
      .setHeader("Authorization", authorization)
      .abortSignal(signal)
      .limit(1)
      .maybeSingle();
    if (assignment.error) throw assignment.error;
    assigned = assignment.data?.member_id === memberId;
  }
  if (!assigned && podLeader) {
    const pod = await supabase
      .from("pods")
      .select("id,pod_members!inner(member_id)")
      .eq("leader_id", actor)
      .eq("pod_members.member_id", memberId)
      .setHeader("Authorization", authorization)
      .abortSignal(signal)
      .limit(1)
      .maybeSingle();
    if (pod.error) throw pod.error;
    assigned = pod.data?.pod_members.some((row) => row.member_id === memberId) ?? false;
  }
  if (!assigned) return null;
  const member = await supabase
    .from("profiles")
    .select("id,display_name")
    .eq("id", memberId)
    .setHeader("Authorization", authorization)
    .abortSignal(signal)
    .maybeSingle();
  if (member.error) throw member.error;
  return member.data?.id === memberId ? member.data : null;
}
