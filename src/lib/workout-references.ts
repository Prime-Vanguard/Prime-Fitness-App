import { z } from "zod";
import { changeMemberState, readMemberState } from "./member-store";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

const previousSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  reps: z.number().nullable(),
  duration_seconds: z.number().nullable(),
  weight_kg: z.number().nullable(),
  created_at: z.string(),
  slot_key: z.string(),
  workout_sessions: z.object({ finished_at: z.string(), origin: z.enum(["native", "import"]) }),
  match: z.enum(["slot", "exercise"]),
});
export type PreviousPerformance = z.infer<typeof previousSchema>;
export type PreviousContext = {
  member: string;
  session: string;
  exercise: string;
  slot: string;
  side: string;
  mode: string;
  convention: string;
};
const cacheSchema = z.object({ at: z.number(), record: previousSchema.nullable() });
const cacheKey = (c: PreviousContext) =>
  `previous-performance:${JSON.stringify([c.exercise, c.slot, c.side, c.mode, c.convention])}`;
const WEEK = 7 * 86400000;

export async function cachedPreviousPerformance(c: PreviousContext, now = Date.now()) {
  const value = cacheSchema.safeParse((await readMemberState(c.member)).references[cacheKey(c)]);
  if (
    !value.success ||
    now - value.data.at > WEEK ||
    value.data.at > now ||
    value.data.record?.session_id === c.session
  )
    return null;
  return value.data.record ? { ...value.data.record, cached: true, cachedAt: value.data.at } : null;
}
export async function loadPreviousPerformance(c: PreviousContext) {
  if (!navigator.onLine) return cachedPreviousPerformance(c);
  const query = () =>
    supabase
      .from("set_logs")
      .select(
        "id,session_id,exercise_id,reps,duration_seconds,weight_kg,created_at,slot_key,workout_sessions!inner(finished_at,origin)",
      )
      .eq("member_id", c.member)
      .eq("exercise_id", c.exercise)
      .neq("session_id", c.session)
      .eq("logging_mode", c.mode)
      .eq("load_convention", c.convention)
      .eq("set_role", "working")
      .eq("side", c.side)
      .not("workout_sessions.finished_at", "is", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);
  try {
    let result = c.slot
      ? await query().eq("slot_key", c.slot).abortSignal(AbortSignal.timeout(12000))
      : await query().abortSignal(AbortSignal.timeout(12000));
    if (result.error) throw result.error;
    let match: "slot" | "exercise" = c.slot ? "slot" : "exercise";
    if (c.slot && !result.data.length) {
      result = await query().abortSignal(AbortSignal.timeout(12000));
      if (result.error) throw result.error;
      match = "exercise";
    }
    const record = result.data[0] ? previousSchema.parse({ ...result.data[0], match }) : null;
    const now = Date.now();
    await changeMemberState(c.member, (s) => {
      const references = { ...s.references };
      for (const [key, value] of Object.entries(references))
        if (key.startsWith("previous-performance:")) {
          const parsed = cacheSchema.safeParse(value);
          if (!parsed.success || now - parsed.data.at > WEEK) delete references[key];
        }
      references[cacheKey(c)] = { at: now, record } as unknown as Json;
      return { ...s, references };
    });
    return record ? { ...record, cached: false, cachedAt: now } : null;
  } catch (error) {
    const cached = await cachedPreviousPerformance(c);
    if (cached) return cached;
    throw error;
  }
}

export async function readRestPreference(member: string, key: string, fallback = 90) {
  const prefs = (await readMemberState(member)).references["workout-rest-preferences"];
  if (prefs && typeof prefs === "object" && !Array.isArray(prefs)) {
    const value = prefs[key];
    if (typeof value === "number" && Number.isInteger(value) && value >= 15 && value <= 600)
      return value;
  }
  return fallback;
}
export async function saveRestPreference(member: string, key: string, seconds: number) {
  if (!Number.isInteger(seconds) || seconds < 15 || seconds > 600)
    throw new Error("Rest must be 15–600 seconds.");
  await changeMemberState(member, (s) => {
    const current = s.references["workout-rest-preferences"];
    return {
      ...s,
      references: {
        ...s.references,
        "workout-rest-preferences": {
          ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}),
          [key]: seconds,
        },
      },
    };
  });
}
