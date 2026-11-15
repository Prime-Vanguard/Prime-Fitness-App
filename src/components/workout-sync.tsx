import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { syncWorkout } from "@/lib/workout-sync";
import { readWorkout, watchWorkout } from "@/lib/workout-store";
import { reportError } from "@/lib/sentry";

// Retries run every 15 seconds, so report once per failure streak (about a minute of failures),
// not on every attempt. Offline failures are dropped by the Sentry filter.
const REPORT_AFTER_FAILURES = 4;

export function WorkoutSync({ userId }: { userId: string }) {
  const qc = useQueryClient();
  useEffect(() => {
    let failures = 0;
    const retry = () => {
      void syncWorkout(userId)
        .then(() => {
          failures = 0;
        })
        .catch((error: unknown) => {
          console.error(error);
          failures += 1;
          if (failures === REPORT_AFTER_FAILURES) {
            reportError(error, {
              area: "workout-sync",
              code: "retries-exhausted",
              count: failures,
            });
          }
        });
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
