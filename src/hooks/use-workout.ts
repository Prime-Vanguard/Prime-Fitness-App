import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  changeWorkout,
  emptyWorkout,
  readWorkout,
  readLegacyWorkout,
  watchWorkout,
  type Workout,
} from "@/lib/workout-store";
import { syncWorkout } from "@/lib/workout-sync";
import { mergeExerciseSnapshots, type PlanItem } from "@/lib/training-tools";
import { fetchAll } from "@/lib/pagination";
import { parseVersionItems } from "@/lib/program-versions";

export function useWorkout(userId: string) {
  const [workout, setWorkout] = useState<Workout>(() => emptyWorkout(userId));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    let alive = true;
    const read = () => {
      void readWorkout(userId)
        .then((w) => {
          if (alive) {
            setWorkout(w);
            setReady(true);
          }
        })
        .catch((e: Error) => {
          if (alive) {
            setError(e.message);
            setReady(true);
          }
        });
    };
    const unwatch = watchWorkout(userId, read);
    const retry = () => {
      setOnline(navigator.onLine);
      void syncWorkout(userId).catch((e: Error) => {
        if (alive) setError(e.message);
      });
    };
    read();
    retry();
    window.addEventListener("online", retry);
    window.addEventListener("offline", retry);
    window.addEventListener("focus", retry);
    // Shell WorkoutSync owns periodic retries; this view keeps immediate/manual triggers.
    // Seed reference data and any already-open remote session. Pending local
    // data always wins and is never replaced by a stale network response.
    void (async () => {
      if (!navigator.onLine) return;
      const initial = await readWorkout(userId);
      const hasLegacy = !!(await readLegacyWorkout(userId));
      const [ex, remote] = await Promise.all([
        fetchAll(
          (from, to) =>
            supabase
              .from("exercises")
              .select("*")
              .eq("active", true)
              .order("name_en")
              .order("id")
              .range(from, to),
          (row) => row.id,
        ).then((data) => ({ data, error: null })),
        supabase
          .from("workout_sessions")
          .select("*")
          .eq("member_id", userId)
          .is("finished_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (ex.error) throw ex.error;
      await changeWorkout(userId, (w) => ({
        ...w,
        exercises: mergeExerciseSnapshots(
          ex.data as Workout["exercises"],
          w.plan.flatMap((p) => (p.exercise ? [p.exercise] : [])),
        ),
      }));
      if (initial.session || hasLegacy) return;
      if (remote.error) throw remote.error;
      if (!remote.data) return;
      const s = remote.data;
      const sets = await supabase
        .from("set_logs")
        .select("*")
        .eq("session_id", s.id)
        .eq("member_id", userId)
        .order("created_at");
      if (sets.error) throw sets.error;
      let frozenPlan: PlanItem[] = [];
      if (s.occurrence_id) {
        const occurrence = await supabase
          .from("session_occurrences")
          .select("week,day,program_version_id,program_versions(items)")
          .eq("id", s.occurrence_id)
          .single();
        if (occurrence.error) throw occurrence.error;
        frozenPlan = parseVersionItems(occurrence.data.program_versions.items)
          .filter((i) => i.week === occurrence.data.week && i.day === occurrence.data.day)
          .map((i) => ({
            id: i.exercise_id,
            slot_key: `${occurrence.data.program_version_id}:${i.id}`,
            program_version_id: occurrence.data.program_version_id,
            sets: i.target_sets,
            reps: i.target_reps,
            exercise: {
              id: i.exercise_id,
              name_en: i.name_en,
              name_ar: i.name_ar,
              muscle: i.muscle,
              equipment: i.equipment,
              logging_mode: i.logging_mode,
              load_convention: i.load_convention,
            },
          }));
      }
      await changeWorkout(userId, (w) => {
        if (w.session) return w;
        let plan: PlanItem[] = [];
        try {
          plan = frozenPlan.length
            ? frozenPlan
            : (JSON.parse(localStorage.getItem(`pf-plan-${s.id}`) ?? "[]") as PlanItem[]);
        } catch {
          /* Legacy plan is optional. */
        }
        return {
          ...w,
          session: {
            id: s.id,
            member_id: userId,
            title: s.title,
            started_at: s.started_at,
            synced: true,
            ...(s.occurrence_id ? { occurrence_id: s.occurrence_id } : {}),
          },
          notes: s.notes ?? "",
          plan,
          exercises: mergeExerciseSnapshots(
            w.exercises,
            plan.flatMap((p) => (p.exercise ? [p.exercise] : [])),
          ),
          sets: sets.data.map((row) => ({ ...row, sync: "synced" as const })) as Workout["sets"],
        };
      });
    })().catch((e: Error) => {
      if (alive) setError(e.message);
    });
    return () => {
      alive = false;
      unwatch();
      window.removeEventListener("online", retry);
      window.removeEventListener("offline", retry);
      window.removeEventListener("focus", retry);
    };
  }, [userId]);

  const change = async (fn: (w: Workout) => Workout) => {
    const value = await changeWorkout(userId, fn);
    setWorkout(value);
    setError("");
    void syncWorkout(userId).catch((e: Error) => setError(e.message));
    return value;
  };
  const start = async (
    title: string,
    plan: PlanItem[] = [],
    snapshot: Workout["exercises"] = [],
    context?: { occurrence_id?: string; session_id?: string },
  ) => {
    await change((w) => {
      if (w.session) throw new Error("Finish or discard your current workout first.");
      if (!w.exercises.length && !snapshot.length)
        throw new Error("Connect once to download the exercise library before starting offline.");
      return {
        ...emptyWorkout(userId),
        exercises: [
          ...new Map(
            [
              ...w.exercises,
              ...snapshot.map((e) => ({ ...w.exercises.find((old) => old.id === e.id), ...e })),
            ].map((e) => [e.id, e]),
          ).values(),
        ],
        plan: plan.map((p) => ({ ...p, slot_key: p.slot_key || `local:${crypto.randomUUID()}` })),
        session: {
          id: context?.session_id ?? crypto.randomUUID(),
          ...(context?.occurrence_id ? { occurrence_id: context.occurrence_id } : {}),
          member_id: userId,
          title,
          started_at: new Date().toISOString(),
          synced: false,
        },
      };
    });
    void navigator.storage?.persist?.().catch(() => {});
  };
  return { workout, ready, error, online, change, start, retry: () => syncWorkout(userId) };
}
