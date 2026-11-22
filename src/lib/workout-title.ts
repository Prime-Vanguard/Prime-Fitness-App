import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { changeMemberState } from "./member-store";
import { workoutHistorySnapshotSchema } from "./workout-history-cache";

/** Member-typed workout names: trimmed, 1–80 characters. */
export const workoutTitleSchema = z.string().trim().min(1).max(80);

/** Renames a saved workout; RLS limits this to the member's own sessions. */
export async function renameWorkout(memberId: string, sessionId: string, title: string) {
  const name = workoutTitleSchema.parse(title);
  const { data, error } = await supabase
    .from("workout_sessions")
    .update({ title: name })
    .eq("id", sessionId)
    .eq("member_id", memberId)
    .select("id");
  if (error) throw error;
  if (!data.length) throw new Error("Workout was not found.");
  // Keep the downloaded offline history in step; the next download corrects any miss.
  await changeMemberState(memberId, (state) => {
    const cached = workoutHistorySnapshotSchema.safeParse(state.references["workoutHistory"]);
    if (!cached.success || cached.data.memberId !== memberId) return state;
    return {
      ...state,
      references: {
        ...state.references,
        workoutHistory: {
          ...cached.data,
          entries: cached.data.entries.map((entry) =>
            entry.session.id === sessionId
              ? { ...entry, session: { ...entry.session, title: name } }
              : entry,
          ),
        },
      },
    };
  }).catch(() => undefined);
}
