import { activityDay } from "./dates";
import { validActivityDate } from "./training-search";
export type SetRow = {
  exercise_id: string;
  reps: number | null;
  weight_kg: number | null;
  created_at: string;
  set_role?: string;
  logging_mode?: string;
  side?: string;
  workout_sessions?: { origin?: string; activity_date?: string | null } | null;
};
export function recordDay(set: Pick<SetRow, "created_at" | "workout_sessions">) {
  return set.workout_sessions?.origin === "import" &&
    validActivityDate(set.workout_sessions.activity_date)
    ? set.workout_sessions.activity_date
    : activityDay(set.created_at);
}

/** Epley estimated one-rep max. */
export function e1rm(weight: number, reps: number) {
  if (reps <= 0 || weight <= 0) return 0;
  return reps === 1 ? weight : Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function personalRecords(sets: SetRow[]) {
  const map = new Map<
    string,
    { bestWeight: number; bestReps: number; best1rm: number; date: string }
  >();
  for (const s of sets) {
    if (
      (s.set_role ?? "working") !== "working" ||
      (s.logging_mode ?? "weighted_reps") !== "weighted_reps" ||
      (s.side ?? "bilateral") !== "bilateral"
    )
      continue;
    const w = Number(s.weight_kg ?? 0),
      r = s.reps ?? 0;
    if (w <= 0 || r <= 0) continue;
    const est = e1rm(w, r);
    const cur = map.get(s.exercise_id);
    if (!cur || est > cur.best1rm)
      map.set(s.exercise_id, {
        bestWeight: w,
        bestReps: r,
        best1rm: est,
        date: s.workout_sessions?.origin === "import" ? recordDay(s) : s.created_at,
      });
  }
  return map;
}

/** Best estimated 1RM per day for one exercise, oldest first. */
export function dailyBest(sets: SetRow[], exerciseId: string) {
  const byDay = new Map<string, number>();
  for (const s of sets) {
    if (
      (s.set_role ?? "working") !== "working" ||
      (s.logging_mode ?? "weighted_reps") !== "weighted_reps" ||
      (s.side ?? "bilateral") !== "bilateral"
    )
      continue;
    if (s.exercise_id !== exerciseId) continue;
    const est = e1rm(Number(s.weight_kg ?? 0), s.reps ?? 0);
    if (!est) continue;
    const d = recordDay(s);
    byDay.set(d, Math.max(byDay.get(d) ?? 0, est));
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}
