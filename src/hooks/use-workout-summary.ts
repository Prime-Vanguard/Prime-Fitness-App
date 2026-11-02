import { useEffect, useState } from "react";
import { readWorkout, watchWorkout, type Workout } from "@/lib/workout-store";

/** Read-only subscription; the shell must not seed or synchronize another controller. */
export function useWorkoutSummary(userId: string) {
  const [value, setValue] = useState<Workout | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () =>
      void readWorkout(userId)
        .then((w) => {
          if (alive) setValue(w);
        })
        .catch(() => {
          if (alive) setValue(null);
        });
    const stop = watchWorkout(userId, read);
    read();
    return () => {
      alive = false;
      stop();
    };
  }, [userId]);
  return value?.userId === userId ? value : null;
}
