import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { requireActiveAdmin } from "./admin-member-write";
import { fetchAll } from "./pagination";
import { inputNumber } from "./numeric-input";
export type PvTask = Database["public"]["Tables"]["pv_tasks"]["Row"];
export type PvClaim = Database["public"]["Tables"]["pv_claims"]["Row"];
export type ClaimContext = PvClaim & {
  pv_tasks: Pick<PvTask, "id" | "title_en" | "title_ar" | "points" | "active"> | null;
};
export type Decision = "approved" | "rejected" | "needs_info";
export const claimFields = [
  "status",
  "note",
  "review_note",
  "reviewed_at",
  "reviewed_by",
  "member_id",
  "task_id",
  "created_at",
] as const;
export function sameClaim(a: PvClaim, b: PvClaim) {
  return a.id === b.id && claimFields.every((key) => a[key] === b[key]);
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function pvSearch(raw: Record<string, unknown>): {
  section?: "tasks" | undefined;
  status?: "needs_info" | "reviewed" | undefined;
  q?: string | undefined;
  page?: number | undefined;
  claim?: string | undefined;
} {
  return {
    section: raw["section"] === "tasks" ? "tasks" : undefined,
    status:
      raw["status"] === "needs_info" || raw["status"] === "reviewed" ? raw["status"] : undefined,
    q: typeof raw["q"] === "string" ? raw["q"].slice(0, 150) || undefined : undefined,
    page:
      Number.isSafeInteger(Number(raw["page"])) && Number(raw["page"]) > 1
        ? Math.min(Number(raw["page"]), 100000)
        : undefined,
    claim: typeof raw["claim"] === "string" && uuid.test(raw["claim"]) ? raw["claim"] : undefined,
  };
}
export async function loadPvTasks(signal: AbortSignal) {
  return fetchAll(
    (from, to) =>
      supabase
        .from("pv_tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to)
        .abortSignal(signal)
        .retry(false),
    (r) => r.id,
  );
}
export async function loadClaimQueue(status: string, signal: AbortSignal) {
  const statuses =
    status === "reviewed"
      ? ["approved", "rejected"]
      : status === "needs_info"
        ? ["needs_info"]
        : ["pending"];
  const claims = await fetchAll(
    (from, to) =>
      supabase
        .from("pv_claims")
        .select("*,pv_tasks(id,title_en,title_ar,points,active)")
        .in("status", statuses)
        .order("created_at")
        .order("id")
        .range(from, to)
        .abortSignal(signal)
        .retry(false),
    (r) => r.id,
  );
  const ids = [...new Set(claims.map((c) => c.member_id))].sort();
  const people: { id: string; display_name: string | null; email: string | null }[] = [];
  for (let offset = 0; offset < ids.length; offset += 50)
    people.push(
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
  return { claims, people };
}
export async function loadClaim(id: string, signal?: AbortSignal) {
  let query = supabase
    .from("pv_claims")
    .select("*,pv_tasks(id,title_en,title_ar,points,active)")
    .eq("id", id);
  if (signal) query = query.abortSignal(signal);
  const result = await query.maybeSingle().retry(false);
  if (result.error) throw result.error;
  if (!result.data) throw new Error("This claim is unavailable. Reload the queue.");
  return result.data;
}
export function taskInput(form: { title_en: string; title_ar: string; points: string }) {
  const title = form.title_en.trim(),
    arabic = form.title_ar.trim();
  if (!title || title.length > 200 || arabic.length > 200)
    throw new Error(
      "Task titles must contain at most 200 characters; an English title is required.",
    );
  const points = inputNumber(form.points, {
    label: "PV points",
    min: 1,
    max: 2147483647,
    integer: true,
  });
  if (points == null) throw new Error("Enter the task’s PV points.");
  return { title_en: title, title_ar: arabic || null, points };
}
export async function createPvTask(
  actor: string,
  input: { id: string; title_en: string; title_ar: string | null; points: number },
  onDispatch?: () => void,
) {
  await requireActiveAdmin(actor);
  const values = taskInput({
    ...input,
    title_ar: input.title_ar ?? "",
    points: String(input.points),
  });
  const existing = await supabase.from("pv_tasks").select("*").eq("id", input.id).maybeSingle();
  if (existing.error) throw existing.error;
  const matches = (row: PvTask) =>
    row.created_by === actor &&
    row.title_en === values.title_en &&
    row.title_ar === values.title_ar &&
    row.points === values.points;
  if (existing.data) {
    if (matches(existing.data)) return existing.data;
    throw new Error("This request already saved a different task. Reload task management.");
  }
  onDispatch?.();
  const result = await supabase
    .from("pv_tasks")
    .insert({ id: input.id, ...values, created_by: actor })
    .select("*")
    .single();
  if (result.error) throw result.error;
  if (!result.data || result.data.id !== input.id || !matches(result.data))
    throw new Error("Task creation was not confirmed. Retry this same request.");
  return result.data;
}
export async function setPvTaskActive(actor: string, task: PvTask, active: boolean) {
  await requireActiveAdmin(actor);
  const current = await supabase.from("pv_tasks").select("*").eq("id", task.id).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) throw new Error("Task unavailable. Reload task management.");
  if (current.data.active === active) return current.data;
  if (
    current.data.points !== task.points ||
    current.data.title_en !== task.title_en ||
    current.data.title_ar !== task.title_ar
  )
    throw new Error("Task details changed. Reload and review again.");
  let update = supabase
    .from("pv_tasks")
    .update({ active })
    .eq("id", task.id)
    .eq("active", task.active)
    .eq("points", task.points)
    .eq("title_en", task.title_en);
  update =
    task.title_ar == null ? update.is("title_ar", null) : update.eq("title_ar", task.title_ar);
  const result = await update.select("*").maybeSingle();
  if (result.error) throw result.error;
  if (!result.data || result.data.active !== active)
    throw new Error("Task visibility was not confirmed. Reload and review again.");
  return result.data;
}
export function decisionInput(status: Decision, text: string) {
  if (!["approved", "rejected", "needs_info"].includes(status))
    throw new Error("Choose a valid review decision.");
  const note = text.trim();
  if (note.length > 2000) throw new Error("Decision reason must be at most 2,000 characters.");
  if (status !== "approved" && !note)
    throw new Error("Give a reason for rejection or requesting more information.");
  return { status, review_note: note || null };
}
async function decisionReceipt(claim: PvClaim) {
  if (claim.status !== "approved") return { claim, awarded: null };
  const result = await supabase
    .from("pv_ledger")
    .select("points,member_id,claim_id")
    .eq("claim_id", claim.id)
    .maybeSingle();
  if (result.error) throw result.error;
  if (
    !result.data ||
    result.data.member_id !== claim.member_id ||
    !Number.isInteger(result.data.points) ||
    result.data.points <= 0
  )
    throw new Error(
      "The decision is saved, but its server award receipt could not be confirmed. Retry to check the same claim; do not create another approval.",
    );
  return { claim, awarded: result.data.points };
}
export async function decidePvClaim(
  actor: string,
  original: ClaimContext,
  status: Decision,
  note: string,
  onDispatch?: () => void,
) {
  await requireActiveAdmin(actor);
  if (original.member_id === actor) throw new Error("You cannot review your own claim.");
  const input = decisionInput(status, note),
    current = await loadClaim(original.id);
  if (current.member_id === actor) throw new Error("You cannot review your own claim.");
  if (
    current.status === input.status &&
    current.review_note === input.review_note &&
    current.reviewed_by === actor &&
    current.reviewed_at !== original.reviewed_at
  )
    return decisionReceipt(current);
  if (current.status === "approved" || current.status === "rejected")
    throw new Error("This claim was already decided. Reload its saved decision.");
  if (!sameClaim(current, original))
    throw new Error(
      "This claim changed in another tab or session. Your draft is retained; reload and review the current claim.",
    );
  if (
    !current.pv_tasks ||
    current.pv_tasks.points !== original.pv_tasks?.points ||
    current.pv_tasks.title_en !== original.pv_tasks?.title_en ||
    current.pv_tasks.title_ar !== original.pv_tasks?.title_ar
  )
    throw new Error("The task or its points changed. Reload the claim before deciding.");
  if (current.status === input.status && current.review_note === input.review_note)
    throw new Error("This review has no changes.");
  let update = supabase.from("pv_claims").update(input).eq("id", original.id);
  for (const key of claimFields)
    update = original[key] == null ? update.is(key, null) : update.eq(key, original[key]!);
  onDispatch?.();
  const result = await update.select("*").maybeSingle();
  if (result.error) throw result.error;
  if (
    !result.data ||
    result.data.status !== status ||
    result.data.reviewed_by !== actor ||
    result.data.review_note !== input.review_note
  )
    throw new Error(
      "Review was not confirmed. Your decision is retained; retry to check its outcome.",
    );
  return decisionReceipt(result.data);
}
