import type { Exercise, PlanItem } from "./training-tools";
import { setDetailsSchema, validateSetDetails, type SetDetails } from "./training-model";
import { deviceScope } from "./device-scope";

export type WorkoutSet = { [K in keyof SetDetails]?: SetDetails[K] | undefined } & {
  id: string;
  session_id: string;
  member_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  created_at: string;
  sync: "pending" | "synced" | "deleted";
  localRevision?: number | undefined;
};
export type Workout = {
  version: 2;
  userId: string;
  session: {
    id: string;
    member_id: string;
    started_at: string;
    title: string | null;
    synced: boolean;
    occurrence_id?: string | undefined;
  } | null;
  exercises: Exercise[];
  sets: WorkoutSet[];
  plan: PlanItem[];
  superset: string[];
  supersetSlots?: string[] | undefined;
  notes: string;
  restEnd: number;
  phase: "active" | "finishing" | "discarding";
  finishedAt: string | null;
  error: string | null;
  holdStartedAt?: number | null | undefined;
  editor?: import("./workout-editor").WorkoutEditorState | undefined;
};
export const emptyWorkout = (userId: string): Workout => ({
  version: 2,
  userId,
  session: null,
  exercises: [],
  sets: [],
  plan: [],
  superset: [],
  notes: "",
  restEnd: 0,
  phase: "active",
  finishedAt: null,
  error: null,
});

let database: Promise<IDBDatabase> | undefined;
function db() {
  if (!database)
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("prime-fitness-workouts", 3);
      req.onupgradeneeded = () => {
        const store = req.result.objectStoreNames.contains("workouts")
          ? req.transaction!.objectStore("workouts")
          : req.result.createObjectStore("workouts");
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const item = cursor.result;
          if (item) {
            if (item.value.version === 1)
              item.update({
                ...item.value,
                version: 2,
                sets: item.value.sets.map((s: WorkoutSet) => ({
                  ...setDetailsSchema.parse(s),
                  ...s,
                })),
              });
            item.continue();
          }
        };
      };
      req.onsuccess = () => {
        req.result.onversionchange = () => {
          req.result.close();
          database = undefined;
        };
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () =>
        reject(new Error("Close other Prime Fitness tabs to update workout storage."));
    }).catch((error: unknown) => {
      database = undefined;
      throw error;
    });
  return database;
}

export async function readWorkout(userId: string): Promise<Workout> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("workouts", "readonly");
    const req = tx.objectStore("workouts").get(deviceScope(userId));
    req.onsuccess = () => {
      const value = req.result as Workout | undefined;
      if (value && (value.version !== 2 || value.userId !== userId))
        return reject(new Error("Unsupported workout storage version."));
      resolve(value ?? emptyWorkout(userId));
    };
    req.onerror = () => reject(req.error);
  });
}

// A read and its write share one IDB transaction, including across browser tabs.
export async function changeWorkout(
  userId: string,
  change: (value: Workout) => Workout,
): Promise<Workout> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("workouts", "readwrite");
    const store = tx.objectStore("workouts");
    const req = store.get(deviceScope(userId));
    let next: Workout;
    req.onsuccess = () => {
      try {
        const current = req.result as Workout | undefined;
        if (current && (current.version !== 2 || current.userId !== userId))
          throw new Error("Unsupported workout storage version.");
        next = change(current ?? emptyWorkout(userId));
        store.put(next, deviceScope(userId));
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    tx.oncomplete = () => {
      announce(userId);
      resolve(next);
    };
    tx.onerror = () => reject(tx.error ?? new Error("Workout could not be saved on this device."));
    tx.onabort = () => reject(tx.error ?? new Error("Workout save was interrupted. Please retry."));
  });
}

/** Old keys have no project provenance: never resume or upload them automatically. */
export async function readLegacyWorkout(userId: string): Promise<Workout | null> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction("workouts").objectStore("workouts").get(userId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const value = req.result as Workout | undefined;
      if (value && (value.userId !== userId || value.version !== 2))
        return reject(
          new Error("Legacy workout requires recovery review; it has not been removed."),
        );
      resolve(value ?? null);
    };
  });
}
export async function adoptLegacyWorkout(userId: string) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction("workouts", "readwrite"),
      store = tx.objectStore("workouts");
    const legacy = store.get(userId),
      scoped = store.get(deviceScope(userId));
    scoped.onsuccess = () => {
      try {
        const value = legacy.result as Workout | undefined,
          current = scoped.result as Workout | undefined;
        if (!value || value.userId !== userId || value.version !== 2)
          throw new Error("The legacy draft changed. Reload before reviewing it.");
        if (current && (current.session || current.sets.length || current.notes || current.editor))
          throw new Error(
            "Finish or export the current project draft before recovering the legacy draft.",
          );
        store.put(
          {
            ...value,
            exercises: [
              ...new Map(
                [...(current?.exercises ?? []), ...value.exercises].map((e) => [e.id, e]),
              ).values(),
            ],
          },
          deviceScope(userId),
        );
        store.delete(userId);
      } catch (e) {
        tx.abort();
        reject(e);
      }
    };
    tx.oncomplete = () => {
      announce(userId);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Recovery interrupted. Both drafts are retained."));
  });
}

let channel: BroadcastChannel | undefined;
function messages() {
  if (typeof BroadcastChannel === "undefined") return undefined;
  if (!channel) {
    channel = new BroadcastChannel("pf-workouts");
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data === "string")
        window.dispatchEvent(new CustomEvent("pf-workout-change", { detail: event.data }));
    };
  }
  return channel;
}
function announce(userId: string) {
  const scope = deviceScope(userId);
  window.dispatchEvent(new CustomEvent("pf-workout-change", { detail: scope }));
  messages()?.postMessage(scope);
}
export function watchWorkout(userId: string, callback: () => void) {
  messages();
  const handler = (event: Event) => {
    if ((event as CustomEvent<string>).detail === deviceScope(userId)) callback();
  };
  window.addEventListener("pf-workout-change", handler);
  return () => window.removeEventListener("pf-workout-change", handler);
}

export function appendSet(
  workout: Workout,
  input: Pick<WorkoutSet, "exercise_id" | "reps" | "weight_kg" | "rpe"> & Partial<SetDetails>,
): Workout {
  if (!workout.session || workout.phase !== "active")
    throw new Error("This workout is waiting to finish syncing.");
  const details = validateSetDetails(input);
  if (
    !input.exercise_id ||
    (input.weight_kg != null &&
      (!Number.isFinite(input.weight_kg) || input.weight_kg < 0 || input.weight_kg > 1000)) ||
    (input.rpe != null && (!Number.isFinite(input.rpe) || input.rpe < 1 || input.rpe > 10))
  )
    throw new Error("Check reps (1–1000), weight (0–1000 kg), and RPE (1–10).");
  const set_number =
    Math.max(
      0,
      ...workout.sets.filter((s) => s.exercise_id === input.exercise_id).map((s) => s.set_number),
    ) + 1;
  return {
    ...workout,
    sets: [
      ...workout.sets,
      {
        ...details,
        ...input,
        set_number,
        id: crypto.randomUUID(),
        session_id: workout.session.id,
        member_id: workout.userId,
        created_at: new Date().toISOString(),
        sync: "pending",
      },
    ],
  };
}

export const pendingCount = (workout: Workout) =>
  (workout.session && !workout.session.synced ? 1 : 0) +
  workout.sets.filter((s) => s.sync !== "synced").length +
  (workout.phase !== "active" ? 1 : 0);
