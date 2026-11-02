import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { syncWorkout } from "@/lib/workout-sync";
import { readWorkout, watchWorkout } from "@/lib/workout-store";

export function WorkoutSync({ userId }: { userId: string }) {
  const qc = useQueryClient();
  useEffect(() => {
    const retry = () => {
      void syncWorkout(userId).catch(console.error);
    };
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
    retry();
    const timer = window.setInterval(retry, 15000);
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => {
      unwatch();
      clearInterval(timer);
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
    };
  }, [userId, qc]);
  return null;
}
