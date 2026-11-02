import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { requireActiveAdmin } from "./admin-member-write";
import { fetchAll } from "./pagination";

export type Pod = Database["public"]["Tables"]["pods"]["Row"];
export type PodCreation = Pick<Pod, "id" | "name" | "leader_id">;
export function podSearch(raw: Record<string, unknown>): {
  q?: string | undefined;
  page?: number | undefined;
  pod?: string | undefined;
} {
  const page = Number(raw["page"]);
  return {
    ...(typeof raw["q"] === "string" && raw["q"].trim() ? { q: raw["q"].slice(0, 150) } : {}),
    ...(Number.isSafeInteger(page) && page > 1 ? { page: Math.min(page, 100000) } : {}),
    ...(typeof raw["pod"] === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(raw["pod"])
      ? { pod: raw["pod"] }
      : {}),
  };
}
export async function loadPods(signal: AbortSignal) {
  const [pods, memberships] = await Promise.all([
    fetchAll(
      (from, to) =>
        supabase
          .from("pods")
          .select("*")
          .order("name")
          .order("id")
          .range(from, to)
          .abortSignal(signal)
          .retry(false),
      (r) => r.id,
    ),
    fetchAll(
      (from, to) =>
        supabase
          .from("pod_members")
          .select("pod_id,member_id,created_at")
          .order("pod_id")
          .order("member_id")
          .range(from, to)
          .abortSignal(signal)
          .retry(false),
      (r) => `${r.pod_id}:${r.member_id}`,
    ),
  ]);
  const ids = [...new Set(pods.flatMap((p) => (p.leader_id ? [p.leader_id] : [])))].sort();
  const leaders: { id: string; display_name: string | null; email: string | null }[] = [];
  for (let offset = 0; offset < ids.length; offset += 50)
    leaders.push(
      ...(await fetchAll(
        (from, to) =>
          supabase
            .from("profiles")
            .select("id,display_name,email")
            .in("id", ids.slice(offset, offset + 50))
            .order("id")
            .range(from, to)
            .abortSignal(signal)
            .retry(false),
        (r) => r.id,
      )),
    );
  return { pods, memberships, leaders };
}
export async function loadPodPeople(signal: AbortSignal) {
  const [people, roles] = await Promise.all([
    fetchAll(
      (from, to) =>
        supabase
          .from("profiles")
          .select("id,display_name,email,access_active")
          .order("display_name")
          .order("id")
          .range(from, to)
          .abortSignal(signal)
          .retry(false),
      (r) => r.id,
    ),
    fetchAll(
      (from, to) =>
        supabase
          .from("user_roles")
          .select("user_id,role")
          .eq("role", "pod_leader")
          .order("user_id")
          .range(from, to)
          .abortSignal(signal)
          .retry(false),
      (r) => r.user_id,
    ),
  ]);
  return { people, leaderIds: new Set(roles.map((r) => r.user_id)) };
}
export type PodData = Awaited<ReturnType<typeof loadPods>>;
export type PodPeople = Awaited<ReturnType<typeof loadPodPeople>>;
async function readPod(id: string) {
  const result = await supabase.from("pods").select("*").eq("id", id).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}
async function requireLeader(id: string | null) {
  if (!id) return;
  const [profile, role] = await Promise.all([
    supabase.from("profiles").select("access_active").eq("id", id).maybeSingle(),
    supabase
      .from("user_roles")
      .select("user_id")
      .eq("user_id", id)
      .eq("role", "pod_leader")
      .maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (role.error) throw role.error;
  if (!profile.data?.access_active || !role.data)
    throw new Error(
      "Choose an active member with the Pod Leader role. Refresh the available people and review again.",
    );
}
export async function createPod(actor: string, input: PodCreation, onDispatch?: () => void) {
  await requireActiveAdmin(actor);
  const name = input.name.trim();
  if (!name || name.length > 100) throw new Error("Pod name must contain 1–100 characters.");
  const existing = await readPod(input.id);
  if (existing) {
    if (existing.name === name && existing.leader_id === input.leader_id) return existing;
    throw new Error(
      "This creation request already saved a different Pod. Refresh the list and resolve the original request.",
    );
  }
  await requireLeader(input.leader_id);
  onDispatch?.();
  const result = await supabase
    .from("pods")
    .insert({ id: input.id, name, leader_id: input.leader_id })
    .select("*")
    .single();
  if (result.error) {
    if (result.error.code === "23505") {
      const saved = await readPod(input.id);
      if (saved?.name === name && saved.leader_id === input.leader_id) return saved;
    }
    throw result.error;
  }
  if (
    !result.data ||
    result.data.id !== input.id ||
    result.data.name !== name ||
    result.data.leader_id !== input.leader_id
  )
    throw new Error(
      "Pod creation was not confirmed. Your request is retained; retry to check the same Pod ID.",
    );
  return result.data;
}
export async function changePodLeader(actor: string, original: Pod, leader: string | null) {
  await requireActiveAdmin(actor);
  const current = await readPod(original.id);
  if (!current) throw new Error("This Pod is unavailable. Refresh the list.");
  if (current.leader_id === leader) return current;
  if (current.updated_at !== original.updated_at || current.leader_id !== original.leader_id)
    throw new Error(
      "This Pod changed in another tab or session. Keep your draft, then reload the saved leader.",
    );
  await requireLeader(leader);
  let update = supabase
    .from("pods")
    .update({ leader_id: leader })
    .eq("id", original.id)
    .eq("updated_at", original.updated_at);
  update =
    original.leader_id == null
      ? update.is("leader_id", null)
      : update.eq("leader_id", original.leader_id);
  const result = await update.select("*").maybeSingle();
  if (result.error) throw result.error;
  if (!result.data || result.data.leader_id !== leader)
    throw new Error(
      "Leader change was not confirmed. Your selection is retained; refresh and review again.",
    );
  return result.data;
}
async function membership(pod: string, member: string) {
  const result = await supabase
    .from("pod_members")
    .select("pod_id,member_id,created_at")
    .eq("pod_id", pod)
    .eq("member_id", member)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}
export async function addPodMember(actor: string, pod: string, member: string) {
  await requireActiveAdmin(actor);
  if (!(await readPod(pod))) throw new Error("This Pod is unavailable. Refresh the list.");
  const existing = await membership(pod, member);
  if (existing) return existing;
  const result = await supabase
    .from("pod_members")
    .insert({ pod_id: pod, member_id: member })
    .select("*")
    .single();
  if (result.error) {
    if (result.error.code === "23505") {
      const saved = await membership(pod, member);
      if (saved) return saved;
    }
    throw result.error;
  }
  if (result.data?.pod_id !== pod || result.data?.member_id !== member)
    throw new Error("Member addition was not confirmed. Your selection is retained.");
  return result.data;
}
export async function removePodMember(
  actor: string,
  pod: string,
  member: string,
  expectedCreatedAt: string,
) {
  await requireActiveAdmin(actor);
  if (!(await readPod(pod))) throw new Error("This Pod is unavailable. Refresh the list.");
  const current = await membership(pod, member);
  if (!current) return;
  // A removal reviewed before somebody re-added the member must not delete the new membership.
  if (current.created_at !== expectedCreatedAt)
    throw new Error("This membership changed. Refresh the roster and review removal again.");
  const result = await supabase
    .from("pod_members")
    .delete()
    .eq("pod_id", pod)
    .eq("member_id", member)
    .eq("created_at", expectedCreatedAt)
    .select("pod_id,member_id")
    .maybeSingle();
  if (result.error) throw result.error;
  if (result.data?.pod_id !== pod || result.data?.member_id !== member)
    throw new Error("Member removal was not confirmed. Refresh the roster and review again.");
}
