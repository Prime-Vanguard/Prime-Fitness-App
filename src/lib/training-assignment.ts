import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { changeMemberState, readMemberState } from "./member-store";
import { versionItemSchema } from "./program-versions";
import { isTransientConnectionError, readOfflineIdentity } from "./offline-access";
import { fetchAll } from "./pagination";
import type { Json } from "@/integrations/supabase/types";

const assignedTrainingSchema = z.object({
  assignmentId: z.string().min(1),
  version: z.object({
    id: z.string().min(1),
    name: z.string(),
    weeks: z.number().int().positive(),
    version: z.number().int().positive(),
    items: z.array(versionItemSchema),
    description: z.string().nullable().default(null),
    program_id: z.string().default(""),
    created_at: z.string().default(""),
    created_by: z.string().nullable().default(null),
  }),
  schedule: z
    .object({
      assignment_id: z.string(),
      member_id: z.string(),
      mode: z.string(),
      start_date: z.string(),
    })
    .nullable(),
  occurrences: z.array(
    z.object({
      id: z.string(),
      member_id: z.string(),
      assignment_id: z.string(),
      program_version_id: z.string(),
      week: z.number().int().positive(),
      day: z.number().int().positive(),
      ordinal: z.number().int(),
      due_date: z.string().nullable(),
      status: z.string(),
    }),
  ),
});
const assignmentSnapshotSchema = z.object({
  version: z.literal(1),
  memberId: z.string(),
  savedAt: z.iso.datetime(),
  assignment: assignedTrainingSchema.nullable(),
});
export type AssignedTraining = z.output<typeof assignedTrainingSchema>;

function validateAssignmentOwnership(assignment: AssignedTraining | null, memberId: string) {
  if (!assignment) return;
  if (
    (assignment.schedule &&
      (assignment.schedule.member_id !== memberId ||
        assignment.schedule.assignment_id !== assignment.assignmentId)) ||
    assignment.occurrences.some(
      (occurrence) =>
        occurrence.member_id !== memberId ||
        occurrence.assignment_id !== assignment.assignmentId ||
        occurrence.program_version_id !== assignment.version.id,
    )
  )
    throw new Error("Training ownership could not be verified.");
}

export async function readAssignedTraining(memberId: string): Promise<AssignedTraining | null> {
  const snapshot = assignmentSnapshotSchema.safeParse(
    (await readMemberState(memberId)).references["assignedTraining"],
  );
  if (!snapshot.success || snapshot.data.memberId !== memberId)
    throw new Error("Open your assigned program online to download it before using it offline.");
  validateAssignmentOwnership(snapshot.data.assignment, memberId);
  return snapshot.data.assignment;
}

/** One frozen version supplies both program and schedule views, including offline. */
export async function loadAssignedTraining(
  memberId: string,
  requireDownload = false,
): Promise<AssignedTraining | null> {
  if (!navigator.onLine) {
    if (requireDownload) throw new Error("Connect before downloading training.");
    return readAssignedTraining(memberId);
  }
  try {
    const assignmentResponse = await supabase
      .from("program_assignments")
      .select("id,program_version_id")
      .eq("member_id", memberId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .abortSignal(AbortSignal.timeout(15000))
      .maybeSingle();
    if (assignmentResponse.error) throw assignmentResponse.error;
    const assignment = assignmentResponse.data;
    let training: AssignedTraining | null = null;
    if (assignment) {
      const [version, schedule, occurrences] = await Promise.all([
        supabase
          .from("program_versions")
          .select("*")
          .eq("id", assignment.program_version_id)
          .abortSignal(AbortSignal.timeout(15000))
          .single(),
        supabase
          .from("program_schedules")
          .select("*")
          .eq("assignment_id", assignment.id)
          .eq("member_id", memberId)
          .abortSignal(AbortSignal.timeout(15000))
          .maybeSingle(),
        fetchAll(
          (first, last) =>
            supabase
              .from("session_occurrences")
              .select("*")
              .eq("assignment_id", assignment.id)
              .eq("member_id", memberId)
              .order("ordinal")
              .order("id")
              .range(first, last)
              .abortSignal(AbortSignal.timeout(15000)),
          (occurrence) => occurrence.id,
        ),
      ]);
      if (version.error) throw version.error;
      if (schedule.error) throw schedule.error;
      if (version.data.id !== assignment.program_version_id)
        throw new Error("Program version changed during download.");
      training = assignedTrainingSchema.parse({
        assignmentId: assignment.id,
        version: version.data,
        schedule: schedule.data,
        occurrences,
      });
      validateAssignmentOwnership(training, memberId);
    }
    // Cache only while this is still the active local account. Never rewrite drafts.
    if (readOfflineIdentity()?.id === memberId) {
      const snapshot = assignmentSnapshotSchema.parse({
        version: 1,
        memberId,
        savedAt: new Date().toISOString(),
        assignment: training,
      });
      try {
        await changeMemberState(memberId, (state) => {
          if (readOfflineIdentity()?.id !== memberId) return state;
          return {
            ...state,
            references: {
              ...state.references,
              assignedTraining: JSON.parse(JSON.stringify(snapshot)) as Json,
            },
          };
        });
      } catch (error) {
        if (requireDownload) throw error;
      }
    } else if (requireDownload) {
      throw new Error("The active account changed during download.");
    }
    return training;
  } catch (error) {
    if (!requireDownload && isTransientConnectionError(error))
      return readAssignedTraining(memberId);
    throw error;
  }
}
