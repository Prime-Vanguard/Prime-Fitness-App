import type { Workout } from "@/lib/workout-store";
/** The view requires these capabilities, independent of a concrete React hook. */
export type WorkoutSessionController = {
  workout: Workout;
  online: boolean;
  change: (update: (workout: Workout) => Workout) => Promise<Workout>;
  retry: () => Promise<void>;
};
