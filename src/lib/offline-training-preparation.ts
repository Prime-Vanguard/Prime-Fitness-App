import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { readOfflineIdentity, withConnectionTimeout } from "./offline-access";
import { loadAssignedTraining } from "./training-assignment";
import { fetchAll } from "./pagination";
import { changeWorkout } from "./workout-store";
import { changeMemberState } from "./member-store";
import { mergeExerciseSnapshots } from "./training-tools";

export const trainingPreparationSchema = z.object({
  version: z.literal(1),
  memberId: z.string(),
  preparedAt: z.iso.datetime(),
  exerciseCount: z.number().int().nonnegative(),
  programName: z.string().nullable(),
});
const exerciseSchema = z
  .object({
    id: z.string().min(1),
    name_en: z.string(),
    name_ar: z.string().nullable(),
    muscle: z.string(),
    equipment: z.string().nullable(),
    instructions: z.string().nullable().optional(),
    logging_mode: z.enum(["weighted_reps", "bodyweight_reps", "timed"]).optional(),
    load_convention: z.enum(["external_total", "per_hand", "bodyweight"]).optional(),
  })
  .passthrough();
function requireTrainingIdentity(memberId: string) {
  if (!navigator.onLine || readOfflineIdentity()?.id !== memberId)
    throw new Error("Training preparation requires the same account and a connection.");
}
export async function prepareTrainingOfflineData(memberId: string) {
  requireTrainingIdentity(memberId);
  const { data: auth, error: authError } = await withConnectionTimeout(supabase.auth.getUser());
  if (authError) throw authError;
  if (auth.user?.id !== memberId)
    throw new Error("Sign in to the same account before downloading training.");
  const profile = await supabase
    .from("profiles")
    .select("access_active")
    .eq("id", memberId)
    .abortSignal(AbortSignal.timeout(15000))
    .maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data?.access_active) throw new Error("Active member access is required.");
  const [training, catalogue] = await Promise.all([
    loadAssignedTraining(memberId, true),
    fetchAll(
      (first, last) =>
        supabase
          .from("exercises")
          .select("*")
          .eq("active", true)
          .order("name_en")
          .order("id")
          .range(first, last)
          .abortSignal(AbortSignal.timeout(15000)),
      (exercise) => exercise.id,
    ),
  ]);
  const exercises = z.array(exerciseSchema).parse(catalogue);
  requireTrainingIdentity(memberId);
  // Update reference data only. In-flight local sets, notes, IDs and tombstones win.
  await changeWorkout(memberId, (workout) => {
    requireTrainingIdentity(memberId);
    return {
      ...workout,
      exercises: mergeExerciseSnapshots(
        exercises,
        workout.plan.flatMap((item) => (item.exercise ? [item.exercise] : [])),
      ),
    };
  });
  const manifest = trainingPreparationSchema.parse({
    version: 1,
    memberId,
    preparedAt: new Date().toISOString(),
    exerciseCount: exercises.length,
    programName: training?.version.name ?? null,
  });
  await changeMemberState(memberId, (state) => {
    requireTrainingIdentity(memberId);
    return { ...state, references: { ...state.references, trainingPreparation: manifest } };
  });
  return manifest;
}
