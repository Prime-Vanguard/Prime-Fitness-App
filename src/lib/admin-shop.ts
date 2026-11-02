import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fetchAll } from "./pagination";
import { requireActiveAdmin } from "./admin-member-write";
import { inputNumber } from "./numeric-input";
export type Reward = Database["public"]["Tables"]["rewards"]["Row"];
export type Redemption = Database["public"]["Tables"]["redemptions"]["Row"];
export function shopSearch(raw: Record<string, unknown>): {
  section?: "queue" | "catalogue" | undefined;
  status?: "pending" | "fulfilled" | "rejected" | "all" | undefined;
  q?: string | undefined;
  page?: number | undefined;
} {
  const page = Number(raw["page"]);
  return {
    section: raw["section"] === "catalogue" ? "catalogue" : undefined,
    status: ["fulfilled", "rejected", "all"].includes(String(raw["status"]))
      ? (raw["status"] as "fulfilled" | "rejected" | "all")
      : undefined,
    q: typeof raw["q"] === "string" ? raw["q"].slice(0, 150) || undefined : undefined,
    page: Number.isSafeInteger(page) && page > 1 && page <= 1000000 ? page : undefined,
  };
}
export type ShopSearch = ReturnType<typeof shopSearch>;
export const emptyReward = () => ({ title_en: "", title_ar: "", cost: "", stock: "" });
export function rewardInput(form: ReturnType<typeof emptyReward>) {
  const title_en = form.title_en.trim(),
    title_ar = form.title_ar.trim();
  if (!title_en || title_en.length > 200 || title_ar.length > 200)
    throw new Error("Enter an English title; titles may contain at most 200 characters.");
  const cost_pv = inputNumber(form.cost, {
    label: "PV cost",
    min: 1,
    max: 2147483647,
    integer: true,
  });
  if (cost_pv == null) throw new Error("Enter the PV cost.");
  const stock = inputNumber(form.stock, { label: "Stock", min: 0, max: 2147483647, integer: true });
  return { title_en, title_ar: title_ar || null, cost_pv, stock };
}
export function loadRewards(signal: AbortSignal) {
  return fetchAll(
    (a, b) =>
      supabase
        .from("rewards")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(a, b)
        .abortSignal(signal)
        .retry(false),
    (r) => r.id,
  );
}
export function loadRedemptions(
  signal: AbortSignal,
  status: "pending" | "fulfilled" | "rejected" | "all" = "pending",
) {
  return fetchAll(
    (a, b) => {
      let query = supabase
        .from("redemptions")
        .select("*")
        .order("created_at")
        .order("id")
        .range(a, b);
      if (status !== "all") query = query.eq("status", status);
      return query.abortSignal(signal).retry(false);
    },
    (r) => r.id,
  );
}
export function loadShopPeople(signal: AbortSignal) {
  return fetchAll(
    (a, b) =>
      supabase
        .from("profiles")
        .select("id,display_name,email")
        .order("id")
        .range(a, b)
        .abortSignal(signal)
        .retry(false),
    (r) => r.id,
  );
}
export async function createReward(
  actor: string,
  id: string,
  form: ReturnType<typeof emptyReward>,
  dispatch: () => void,
) {
  await requireActiveAdmin(actor);
  const values = rewardInput(form);
  const current = await supabase.from("rewards").select("*").eq("id", id).maybeSingle();
  if (current.error) throw current.error;
  if (current.data) {
    if (
      current.data.created_by === actor &&
      Object.entries(values).every(
        ([k, v]) => k === "stock" || current.data![k as keyof Reward] === v,
      )
    )
      return current.data;
    throw new Error("This request already created another reward. Reload the catalogue.");
  }
  dispatch();
  const result = await supabase
    .from("rewards")
    .insert({ id, ...values, created_by: actor })
    .select("*")
    .single();
  if (result.error) throw result.error;
  if (result.data?.id !== id)
    throw new Error("Creation was not confirmed. Retry this same request.");
  return result.data;
}
export async function changeRewardVisibility(actor: string, original: Reward) {
  await requireActiveAdmin(actor);
  const active = !original.active;
  const current = await supabase.from("rewards").select("*").eq("id", original.id).maybeSingle();
  if (current.error) throw current.error;
  if (current.data?.active === active) return current.data;
  if (!current.data || current.data.updated_at !== original.updated_at)
    throw new Error("Reward changed. Refresh and review again.");
  const result = await supabase
    .from("rewards")
    .update({ active })
    .eq("id", original.id)
    .eq("active", original.active)
    .eq("updated_at", original.updated_at)
    .select("*")
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Visibility was not confirmed. Refresh and review again.");
  return result.data;
}
export async function reviewRedemption(
  actor: string,
  original: Redemption,
  status: "fulfilled" | "rejected",
  rawNote: string,
) {
  await requireActiveAdmin(actor);
  const note = rawNote.trim();
  if (note.length > 2000 || (status === "rejected" && !note))
    throw new Error("Add a rejection reason; notes may contain at most 2,000 characters.");
  const read = () => supabase.from("redemptions").select("*").eq("id", original.id).maybeSingle();
  const sameReceipt = (row: Redemption) =>
    row.status === status &&
    row.reviewed_by === actor &&
    row.reviewed_at != null &&
    row.review_note === (note || null) &&
    row.member_id === original.member_id &&
    row.reward_id === original.reward_id &&
    row.cost_pv === original.cost_pv;
  const before = await read();
  if (before.error) throw before.error;
  if (before.data && sameReceipt(before.data)) return before.data;
  if (
    !before.data ||
    before.data.status !== "pending" ||
    before.data.review_note !== original.review_note ||
    before.data.cost_pv !== original.cost_pv ||
    before.data.reward_id !== original.reward_id ||
    before.data.member_id !== original.member_id
  )
    throw new Error("Request changed or was already reviewed. Refresh before deciding again.");
  let query = supabase
    .from("redemptions")
    .update({ status, review_note: note || null })
    .eq("id", original.id)
    .eq("status", "pending")
    .eq("member_id", original.member_id)
    .eq("reward_id", original.reward_id)
    .eq("cost_pv", original.cost_pv);
  query =
    original.review_note === null
      ? query.is("review_note", null)
      : query.eq("review_note", original.review_note);
  const result = await query.select("*").maybeSingle();
  if (result.error) throw result.error;
  if (!result.data || !sameReceipt(result.data))
    throw new Error(
      "Decision receipt was not confirmed. Retry the same decision; do not submit an opposite decision.",
    );
  return result.data;
}
