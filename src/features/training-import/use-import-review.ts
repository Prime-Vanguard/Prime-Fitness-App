import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/pagination";
import { activityDay, addDays } from "@/lib/dates";
import type { ImportWorkout } from "@/lib/training-import";
export function useImportReview(userId: string, workouts: ImportWorkout[], enabled: boolean) {
  const {
    data: exercises,
    error: exercisesError,
    refetch: retryExercises,
  } = useQuery({
    queryKey: ["import-exercises", userId],
    enabled: enabled,
    queryFn: () =>
      fetchAll(
        (from, to) =>
          supabase.from("exercises").select("*").eq("active", true).order("id").range(from, to),
        (e) => e.id,
      ),
  });
  const dates = workouts.map((w) => w.activity_date).sort();
  const historyReview = useQuery({
    queryKey: ["import-overlaps", userId, dates[0], dates.at(-1)],
    enabled: enabled && !!workouts.length,
    queryFn: () =>
      fetchAll(
        (from, to) =>
          supabase
            .from("workout_sessions")
            .select("id,title,started_at,activity_date")
            .eq("member_id", userId)
            .not("finished_at", "is", null)
            .gte("started_at", `${addDays(dates[0]!, -1)}T00:00:00Z`)
            .lte("started_at", `${addDays(dates.at(-1)!, 2)}T00:00:00Z`)
            .order("id")
            .range(from, to),
        (r) => r.id,
      ),
  });
  const overlaps = (historyReview.data ?? []).filter((s) =>
    dates.includes(s.activity_date ?? activityDay(s.started_at)),
  );

  return { exercises, exercisesError, retryExercises, dates, historyReview, overlaps };
}
