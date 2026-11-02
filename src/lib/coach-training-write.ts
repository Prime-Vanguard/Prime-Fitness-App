import { supabase } from "@/integrations/supabase/client";
import { coachMemberAccess } from "./coach-member-access";
import type { preparePolicy, PolicyRow } from "./coach-policy";
type Assignment = { id: string; program_version_id: string };
export type Schedule = { mode: string; start_date: string };
async function requireAssignment(actor: string, member: string, assignment: Assignment) {
  if (!(await coachMemberAccess(actor, member)))
    throw new Error("Current coach or active administrator access is required.");
  const result = await supabase
    .from("program_assignments")
    .select("id")
    .eq("id", assignment.id)
    .eq("member_id", member)
    .eq("program_version_id", assignment.program_version_id)
    .eq("active", true)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data)
    throw new Error("The active program changed. Reload the controls before saving.");
}
export async function saveCoachPolicy(
  actor: string,
  member: string,
  assignment: Assignment,
  slot: string,
  exercise: string,
  payload: ReturnType<typeof preparePolicy>,
  original?: PolicyRow,
) {
  await requireAssignment(actor, member, assignment);
  const values = {
    ...payload,
    member_id: member,
    program_version_id: assignment.program_version_id,
    slot_key: `${assignment.program_version_id}:${slot}`,
    exercise_id: exercise,
  };
  const result = original
    ? await supabase
        .from("training_policies")
        .update(values)
        .eq("id", original.id)
        .eq("member_id", member)
        .eq("revision", original.revision)
        .select("id")
        .maybeSingle()
    : await supabase.from("training_policies").insert(values).select("id").maybeSingle();
  if (result.error) {
    if (result.error.code === "23505")
      throw new Error("A policy was created in another tab. Reload before reviewing your changes.");
    throw result.error;
  }
  if (!result.data)
    throw new Error(
      "This policy changed or is no longer writable. Your draft is retained; reload and review it.",
    );
}
export async function saveCoachSchedule(
  actor: string,
  member: string,
  assignment: Assignment,
  target: Schedule,
  original: Schedule | null,
) {
  await requireAssignment(actor, member, assignment);
  const read = () =>
    supabase
      .from("program_schedules")
      .select("mode,start_date")
      .eq("assignment_id", assignment.id)
      .eq("member_id", member)
      .maybeSingle();
  const current = await read();
  if (current.error) throw current.error;
  const same = (left: Schedule | null, right: Schedule | null) =>
    left?.mode === right?.mode && left?.start_date === right?.start_date;
  if (same(current.data, target)) return;
  if (!same(current.data, original))
    throw new Error("The schedule changed in another tab. Reload and review the current dates.");
  const result = await supabase.rpc("configure_program_schedule", {
    _assignment: assignment.id,
    _mode: target.mode,
    _start: target.start_date,
    _expected: original,
  });
  if (result.error) throw result.error;
  const accepted = await read();
  if (accepted.error) throw accepted.error;
  if (!same(accepted.data, target))
    throw new Error(
      "Schedule not confirmed. Keep this draft and check the current schedule before retrying.",
    );
}
