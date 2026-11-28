import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/pagination";
import { personalRecords } from "@/lib/records";

/** Earlier bests per exercise from comparable sets outside this session; decides "New best". */
export async function priorBests(memberId: string, exerciseIds: string[], sessionId: string) {
  return personalRecords(
    await fetchAll(
      (from, to) =>
        supabase
          .from("set_logs")
          .select("id,exercise_id,weight_kg,reps,created_at,set_role,logging_mode,side")
          .eq("member_id", memberId)
          .in("exercise_id", exerciseIds)
          .neq("session_id", sessionId)
          .eq("set_role", "working")
          .eq("logging_mode", "weighted_reps")
          .eq("side", "bilateral")
          .eq("load_convention", "external_total")
          .order("id")
          .range(from, to),
      (row) => row.id,
    ),
  );
}
