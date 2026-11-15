import { changeMemberState, readMemberState } from "@/lib/member-store";
import { supabase } from "@/integrations/supabase/client";

const KEY = "exercise-picker-v1";
const WEEK = 7 * 86400000;
export type PickerPreferences = { favorites: string[]; added: string[] };
const ids = (value: unknown, limit: number) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string => typeof id === "string" && id.length > 0 && id.length <= 128,
          ),
        ),
      ].slice(0, limit)
    : [];
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function decodePickerPreferences(value: unknown): PickerPreferences {
  const raw = object(value);
  return { favorites: ids(raw["favorites"], 200), added: ids(raw["added"], 24) };
}
export async function readPickerPreferences(member: string) {
  return decodePickerPreferences((await readMemberState(member)).references[KEY]);
}
/** Store only catalogue IDs, in the existing project/member-scoped transaction.
 * Desired state makes retries idempotent; unrelated preferences/queued logs survive. */
export async function setPickerFavorite(member: string, id: string, favorite: boolean) {
  const result = await changeMemberState(member, (state) => {
    const current = decodePickerPreferences(state.references[KEY]);
    if (favorite && !current.favorites.includes(id) && current.favorites.length >= 200)
      throw new Error("You can save up to 200 exercise favorites on this device.");
    const favorites = favorite
      ? ids([...current.favorites, id], 200)
      : current.favorites.filter((entry) => entry !== id);
    return { ...state, references: { ...state.references, [KEY]: { ...current, favorites } } };
  });
  return decodePickerPreferences(result.references[KEY]);
}
export async function rememberPickerChoices(member: string, selected: string[]) {
  await changeMemberState(member, (state) => {
    const current = decodePickerPreferences(state.references[KEY]);
    return {
      ...state,
      references: {
        ...state.references,
        [KEY]: { ...current, added: ids([...selected, ...current.added], 24) },
      },
    };
  });
}

/** A bounded recent-performance window, not a complete training-history export.
 * Server RLS remains authoritative; current/unfinished sessions cannot qualify. */
export async function loadPickerHistory(member: string, signal?: AbortSignal) {
  const cached = object((await readMemberState(member)).references["exercise-picker-history"]);
  const validCache =
    typeof cached["at"] === "number" &&
    Date.now() - cached["at"] >= 0 &&
    Date.now() - cached["at"] <= WEEK;
  const fallback = () => ({
    ids: validCache ? ids(cached["ids"], 24) : [],
    cached: true,
    unavailable: !validCache,
  });
  if (!navigator.onLine) return fallback();
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 10000);
  try {
    const result = await supabase
      .from("set_logs")
      .select("exercise_id,created_at,workout_sessions!inner(finished_at)")
      .eq("member_id", member)
      .eq("set_role", "working")
      .not("workout_sessions.finished_at", "is", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(200)
      .abortSignal(controller.signal);
    if (result.error) throw result.error;
    const recent = ids(
      result.data.map((row) => row.exercise_id),
      24,
    );
    // A cache quota failure cannot erase successfully read server history.
    await changeMemberState(member, (state) => ({
      ...state,
      references: {
        ...state.references,
        "exercise-picker-history": { at: Date.now(), ids: recent },
      },
    })).catch(() => {});
    return { ids: recent, cached: false, unavailable: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    return fallback();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
