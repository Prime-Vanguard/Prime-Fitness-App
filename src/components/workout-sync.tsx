import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readWorkout, watchWorkout } from "@/lib/workout-store";

export function WorkoutCompletionRefresh({ userId }: { userId: string }) {
  const qc = useQueryClient();
  useEffect(() => {
    let sessionId: string | undefined;
    const unwatch = watchWorkout(userId, () => {
      void readWorkout(userId)
        .then((w) => {
          if (sessionId && !w.session) {
            for (const key of [
              "sessions",
              "gamification",
              "progress",
              "today",
              "badges",
              "earned-badges",
              "leaderboard",
              "pod-leaderboard",
              "pod-feed",
              "muscle-volume",
            ])
              void qc.invalidateQueries({ queryKey: [key] });
          }
          sessionId = w.session?.id;
        })
        .catch(console.error);
    });
    return unwatch;
  }, [userId, qc]);
  return null;
}
