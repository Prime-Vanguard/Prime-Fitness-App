import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { requireActiveAdmin } from "./admin-member-write";
import { fetchAll } from "./pagination";
export type Invitation = Database["public"]["Tables"]["invites"]["Row"];
export type InviteRole = Invitation["role"];
export const inviteStatuses = ["pending", "accepted", "expired", "revoked"] as const;
export function inviteStatus(
  invite: Invitation,
  now: number,
): (typeof inviteStatuses)[number] | "unknown" {
  if (invite.accepted_at) return "accepted";
  if (invite.revoked_at) return "revoked";
  const expiry = Date.parse(invite.expires_at);
  return !Number.isFinite(expiry) ? "unknown" : expiry <= now ? "expired" : "pending";
}
export function inviteSearch(raw: Record<string, unknown>): {
  q?: string | undefined;
  status?: string | undefined;
  page?: number | undefined;
} {
  return {
    q: typeof raw["q"] === "string" ? raw["q"].slice(0, 150) || undefined : undefined,
    status: inviteStatuses.includes(raw["status"] as never) ? String(raw["status"]) : undefined,
    page:
      Number.isSafeInteger(Number(raw["page"])) && Number(raw["page"]) > 1
        ? Math.min(Number(raw["page"]), 100000)
        : undefined,
  };
}
export async function loadInvitations(signal: AbortSignal) {
  return fetchAll(
    (from, to) =>
      supabase
        .from("invites")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to)
        .abortSignal(signal)
        .retry(false),
    (r) => r.id,
  );
}
export function invitationInput(email: string, role: InviteRole) {
  const result = z.string().trim().toLowerCase().max(254).email().safeParse(email);
  if (!result.success) throw new Error("Enter a valid email address of at most 254 characters.");
  return { email: result.data, role };
}
async function readInvite(id: string) {
  const result = await supabase.from("invites").select("*").eq("id", id).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}
function checkRole(superAdmin: boolean, role: InviteRole) {
  if (!(
    role === "member" ||
    role === "coach" ||
    role === "pod_leader" ||
    (superAdmin && (role === "admin" || role === "super_admin"))
  ))
    throw new Error("Only a current super administrator can manage privileged invitations.");
}
export async function createInvitation(
  actor: string,
  request: { id: string; email: string; role: InviteRole },
  onDispatch?: () => void,
) {
  const superAdmin = await requireActiveAdmin(actor),
    input = invitationInput(request.email, request.role);
  checkRole(superAdmin, input.role);
  const existing = await readInvite(request.id);
  if (existing) {
    if (
      existing.email === input.email &&
      existing.role === input.role &&
      existing.invited_by === actor
    )
      return existing;
    throw new Error(
      "This request already saved a different invitation. Reload the list and resolve the original request.",
    );
  }
  const duplicate = await supabase
    .from("invites")
    .select("id")
    .ilike("email", input.email.replace(/[\\%_]/g, "\\$&"))
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (duplicate.error) throw duplicate.error;
  if (duplicate.data)
    throw new Error(
      "A pending invitation already exists for this email. Search the list before creating another.",
    );
  onDispatch?.();
  const result = await supabase
    .from("invites")
    .insert({ id: request.id, ...input, invited_by: actor })
    .select("*")
    .single();
  if (result.error) {
    if (result.error.code === "23505") {
      const saved = await readInvite(request.id);
      if (saved?.email === input.email && saved.role === input.role && saved.invited_by === actor)
        return saved;
    }
    throw result.error;
  }
  if (
    !result.data ||
    result.data.id !== request.id ||
    result.data.email !== input.email ||
    result.data.role !== input.role ||
    result.data.invited_by !== actor
  )
    throw new Error(
      "Invitation creation was not confirmed. Retry this same request to check its saved outcome.",
    );
  return result.data;
}
export async function revokeInvitation(actor: string, original: Invitation) {
  const superAdmin = await requireActiveAdmin(actor);
  checkRole(superAdmin, original.role);
  const current = await readInvite(original.id);
  if (!current) throw new Error("This invitation is unavailable. Reload the list.");
  if (current.accepted_at)
    throw new Error("This invitation was accepted. Account access must be managed from Members.");
  if (current.revoked_at) return current;
  if (
    current.email !== original.email ||
    current.role !== original.role ||
    current.expires_at !== original.expires_at
  )
    throw new Error("Invitation details changed. Reload and review again.");
  const result = await supabase
    .from("invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", original.id)
    .eq("email", original.email)
    .eq("role", original.role)
    .eq("expires_at", original.expires_at)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("*")
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data?.revoked_at || result.data.accepted_at)
    throw new Error(
      "Revocation was not confirmed. Your review is retained; reload before retrying.",
    );
  return result.data;
}
