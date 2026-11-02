import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchAll } from "@/lib/pagination";
import { exerciseWithSnapshot, type ExerciseGuidance } from "@/lib/exercise-guidance";
import { trainingLabel } from "@/lib/training-labels";
import { displayWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { ExerciseThumbnail } from "./exercise-thumbnail";
import { ExerciseDetail } from "./exercise-discovery";

export function WorkoutHistoryDetail({
  memberId,
  sessionId,
  exercises,
  guidanceEnabled,
  units,
}: {
  memberId: string;
  sessionId: string;
  exercises: ExerciseGuidance[];
  guidanceEnabled: boolean;
  units: Units;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [detail, setDetail] = useState<ExerciseGuidance | null>(null);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["workout-history-detail", memberId, sessionId],
    retry: 0,
    queryFn: async ({ signal }) => {
      const [slots, sets] = await Promise.all([
        fetchAll(
          (from, to) =>
            supabase
              .from("workout_exercises")
              .select("*")
              .eq("member_id", memberId)
              .eq("session_id", sessionId)
              .order("id")
              .range(from, to)
              .abortSignal(signal),
          (row) => row.id,
        ),
        fetchAll(
          (from, to) =>
            supabase
              .from("set_logs")
              .select("*")
              .eq("member_id", memberId)
              .eq("session_id", sessionId)
              .order("set_number")
              .order("id")
              .range(from, to)
              .abortSignal(signal),
          (row) => row.id,
        ),
      ]);
      return { slots, sets };
    },
  });
  if (isPending)
    return (
      <p role="status" className="p-3">
        {l("Loading workout details…", "جارٍ تحميل تفاصيل الجلسة…")}
      </p>
    );
  if (error)
    return (
      <div role="alert" className="p-3">
        {l("Could not load workout details.", "تعذر تحميل تفاصيل الجلسة.")}
        <Button variant="outline" onClick={() => void refetch()}>
          {l("Retry details", "إعادة تحميل التفاصيل")}
        </Button>
      </div>
    );
  const catalogue = new Map(exercises.map((e) => [e.id, e]));
  const groups = new Map<string, { exercise: ExerciseGuidance; sets: Tables<"set_logs">[] }>();
  for (const slot of data?.slots ?? [])
    groups.set(slot.id, {
      exercise: exerciseWithSnapshot(
        slot.exercise_id,
        slot.snapshot,
        catalogue.get(slot.exercise_id),
      ),
      sets: [],
    });
  for (const set of data?.sets ?? []) {
    // Unlinked legacy rows stay separate; never attach them to an arbitrary repeated slot.
    const key =
      set.workout_exercise_id && groups.has(set.workout_exercise_id)
        ? set.workout_exercise_id
        : `legacy:${set.exercise_id}:${set.logging_mode}:${set.load_convention}`;
    if (!groups.has(key))
      groups.set(key, {
        exercise: exerciseWithSnapshot(
          set.exercise_id,
          {
            logging_mode: set.logging_mode,
            load_convention: set.load_convention,
          },
          catalogue.get(set.exercise_id),
        ),
        sets: [],
      });
    groups.get(key)!.sets.push(set);
  }
  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {!groups.size && (
        <p className="text-muted-foreground">
          {l("No recorded exercises.", "لا توجد تمارين مسجلة.")}
        </p>
      )}
      {[...groups].map(([id, group]) => {
        const name = (locale === "ar" && group.exercise.name_ar) || group.exercise.name_en;
        return (
          <section
            key={id}
            className="min-w-0 rounded-lg border border-border p-3"
            aria-label={name}
          >
            <div className="flex items-center gap-3">
              <ExerciseThumbnail
                exercise={group.exercise}
                name={name}
                enabled={guidanceEnabled}
                onOpen={() => setDetail(group.exercise)}
              />
              <div className="min-w-0">
                <h3 className="break-words font-semibold">{name}</h3>
                <p className="text-xs text-muted-foreground">
                  {trainingLabel(group.exercise.load_convention ?? "external_total", locale)}
                </p>
              </div>
            </div>
            {!group.sets.length && (
              <p className="mt-2 text-muted-foreground">
                {l("No recorded sets.", "لا توجد مجموعات مسجلة.")}
              </p>
            )}
            <ol className="mt-2 space-y-2">
              {group.sets.map((set) => (
                <li key={set.id} className="rounded bg-muted/40 p-2 text-sm">
                  <p className="flex flex-wrap gap-x-2">
                    <span>
                      {l("Set", "مجموعة")} {set.set_number} ·{" "}
                      {trainingLabel(set.set_role ?? "working", locale)}
                    </span>
                    {set.side && set.side !== "bilateral" && (
                      <span>{trainingLabel(set.side, locale)}</span>
                    )}
                    {set.root_set_id && (
                      <span>
                        {l("Drop segment", "جزء تنازلي")} {set.segment_index}
                      </span>
                    )}
                  </p>
                  <p className="tabular-nums">
                    {set.logging_mode === "timed"
                      ? `${set.duration_seconds ?? "—"} ${l("sec", "ث")}`
                      : `${set.reps ?? "—"} ${l("reps", "تكرار")}`}
                    {set.weight_kg !== null &&
                      set.weight_kg !== undefined &&
                      ` · ${formatMeasure(displayWeight(set.weight_kg, units))} ${weightUnit(units)}`}
                    {set.rpe !== null && set.rpe !== undefined && ` · RPE ${set.rpe}`}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      {detail && guidanceEnabled && (
        <ExerciseDetail
          key={detail.id}
          exercise={detail}
          startMedia
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
