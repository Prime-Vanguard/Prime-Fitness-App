import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "./pagination";
import { activityDay } from "./dates";
import { weekStart } from "./streaks";
import { historyDateFilter } from "./training-search";
import { normalizeExercise } from "./exercise-guidance";
export type RosterMember = {
  id: string;
  display_name: string | null;
  email: string | null;
  coached: boolean;
  pod: boolean;
};
export const ROSTER_PAGE_SIZE = 20;
export function rosterSearch(raw: Record<string, unknown>) {
  return {
    q: typeof raw["q"] === "string" ? raw["q"].slice(0, 150) : "",
    scope: ["coached", "pod"].includes(String(raw["scope"])) ? String(raw["scope"]) : "all",
    page:
      Number.isSafeInteger(Number(raw["page"])) && Number(raw["page"]) > 0
        ? Math.min(Number(raw["page"]), 100000)
        : 1,
  };
}
export function rosterRouteSearch(raw: Record<string, unknown>): {
  q?: string | undefined;
  scope?: string | undefined;
  page?: number | undefined;
} {
  const value = rosterSearch(raw);
  return {
    q: value.q || undefined,
    scope: value.scope === "all" ? undefined : value.scope,
    page: value.page === 1 ? undefined : value.page,
  };
}
export function filterRoster(rows: RosterMember[], q: string, scope: string) {
  const term = normalizeExercise(q);
  return rows
    .filter(
      (row) =>
        (scope === "all" || (scope === "coached" ? row.coached : row.pod)) &&
        normalizeExercise(`${row.display_name ?? ""} ${row.email ?? ""}`).includes(term),
    )
    .sort(
      (a, b) =>
        normalizeExercise(a.display_name || a.email || "").localeCompare(
          normalizeExercise(b.display_name || b.email || ""),
        ) || a.id.localeCompare(b.id),
    );
}
export async function loadCoachRoster(actor: string, signal: AbortSignal) {
  const [coached, pods] = await Promise.all([
    fetchAll(
      (from, to) =>
        supabase
          .from("coach_assignments")
          .select("id,member_id")
          .eq("coach_id", actor)
          .eq("active", true)
          .order("id")
          .range(from, to)
          .abortSignal(signal),
      (row) => row.id,
    ),
    fetchAll(
      (from, to) =>
        supabase
          .from("pods")
          .select("id")
          .eq("leader_id", actor)
          .order("id")
          .range(from, to)
          .abortSignal(signal),
      (row) => row.id,
    ),
  ]);
  const coachedIds = new Set(coached.map((row) => row.member_id)),
    podIds = new Set<string>();
  for (let offset = 0; offset < pods.length; offset += 50) {
    const rows = await fetchAll(
      (from, to) =>
        supabase
          .from("pod_members")
          .select("pod_id,member_id")
          .in(
            "pod_id",
            pods.slice(offset, offset + 50).map((row) => row.id),
          )
          .order("pod_id")
          .order("member_id")
          .range(from, to)
          .abortSignal(signal),
      (row) => `${row.pod_id}:${row.member_id}`,
    );
    for (const row of rows) podIds.add(row.member_id);
  }
  const ids = [...new Set([...coachedIds, ...podIds])].sort(),
    people: RosterMember[] = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const rows = await fetchAll(
      (from, to) =>
        supabase
          .from("profiles")
          .select("id,display_name,email")
          .in("id", ids.slice(offset, offset + 50))
          .order("id")
          .range(from, to)
          .abortSignal(signal),
      (row) => row.id,
    );
    people.push(
      ...rows.map((row) => ({ ...row, coached: coachedIds.has(row.id), pod: podIds.has(row.id) })),
    );
  }
  return people;
}
/** Exact, bounded reads for the displayed page: no workout or XP-event history download. */
export async function loadRosterSummaries(ids: string[], today: string, signal: AbortSignal) {
  if (ids.length > ROSTER_PAGE_SIZE)
    throw new Error("Roster summaries require a single displayed page.");
  const xp = new Map<string, number>();
  if (ids.length) {
    const result = await supabase
      .from("member_xp_totals")
      .select("member_id,xp")
      .in("member_id", ids)
      .abortSignal(signal);
    if (result.error) throw result.error;
    for (const row of result.data) {
      if (row.member_id) xp.set(row.member_id, Number(row.xp));
    }
  }
  const summaries: { id: string; xp: number; last: string | null; week: number }[] = [];
  for (let offset = 0; offset < ids.length; offset += 4) {
    const batch = await Promise.all(
      ids.slice(offset, offset + 4).map(async (id) => {
        const base = () =>
          supabase
            .from("workout_sessions")
            .select("id,started_at,activity_date")
            .eq("member_id", id)
            .not("finished_at", "is", null);
        const [dated, legacy, count] = await Promise.all([
          base()
            .not("activity_date", "is", null)
            .order("activity_date", { ascending: false })
            .order("id")
            .limit(1)
            .abortSignal(signal),
          base()
            .is("activity_date", null)
            .order("started_at", { ascending: false })
            .order("id")
            .limit(1)
            .abortSignal(signal),
          supabase
            .from("workout_sessions")
            .select("id", { count: "exact", head: true })
            .eq("member_id", id)
            .not("finished_at", "is", null)
            .or(historyDateFilter(weekStart(today), today)!)
            .abortSignal(signal),
        ]);
        for (const result of [dated, legacy, count]) if (result.error) throw result.error;
        if (count.count == null)
          throw new Error("Workout counts are unavailable. Retry summaries.");
        const days = [...(dated.data ?? []), ...(legacy.data ?? [])]
          .map((row) => row.activity_date ?? activityDay(row.started_at))
          .sort();
        const total = xp.get(id) ?? 0;
        if (!Number.isFinite(total)) throw new Error("XP summary is unavailable.");
        return { id, xp: total, last: days.at(-1) ?? null, week: count.count };
      }),
    );
    summaries.push(...batch);
  }
  return summaries;
}
