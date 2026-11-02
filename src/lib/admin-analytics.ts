import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
const count = z.number().int().safe().nonnegative();
export function analyticsSearch(raw: Record<string, unknown>): {
  member?: string | undefined;
  access?: "active" | "paused" | undefined;
  sort?: "name" | "workouts" | undefined;
  page?: number | undefined;
  audit?: boolean | undefined;
  filter?: string | undefined;
} {
  const page = Number(raw["page"]);
  return {
    member:
      typeof raw["member"] === "string" ? raw["member"].slice(0, 150) || undefined : undefined,
    access: raw["access"] === "active" || raw["access"] === "paused" ? raw["access"] : undefined,
    sort: raw["sort"] === "name" || raw["sort"] === "workouts" ? raw["sort"] : undefined,
    page: Number.isSafeInteger(page) && page > 1 && page < 1000000 ? page : undefined,
    audit: raw["audit"] === true || raw["audit"] === "true" ? true : undefined,
    filter:
      typeof raw["filter"] === "string" ? raw["filter"].slice(0, 150) || undefined : undefined,
  };
}
const schema = z.object({
  asOf: z.string(),
  period: z.object({ from7: z.string(), from30: z.string(), to: z.string() }),
  kpi: z.object({
    members: count,
    activeMembers: count,
    engaged7: count,
    workouts7: count,
    workouts30: count,
    pvIssued: count,
    pendingClaims: count,
    pendingRedemptions: count,
  }),
  rows: z.array(
    z.object({
      id: z.string().uuid(),
      display_name: z.string().nullable(),
      email: z.string().nullable(),
      access_active: z.boolean(),
      created_at: z.string(),
      xp: z.number().int().safe(),
      pv: z.number().int().safe(),
      w7: count,
      w30: count,
    }),
  ),
});
export async function adminAnalytics(signal?: AbortSignal) {
  const request = supabase.rpc("get_admin_analytics");
  const result = await (signal ? request.abortSignal(signal) : request);
  if (result.error) throw result.error;
  const snapshot = schema.parse(result.data);
  if (
    snapshot.rows.length !== snapshot.kpi.members ||
    new Set(snapshot.rows.map((row) => row.id)).size !== snapshot.kpi.members
  )
    throw new Error("Analytics roster is incomplete. Retry before exporting.");
  return snapshot;
}
