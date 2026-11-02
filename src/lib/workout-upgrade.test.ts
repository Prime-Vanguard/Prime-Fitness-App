import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { readWorkout, readLegacyWorkout, adoptLegacyWorkout } from "./workout-store";
it("upgrades version-one drafts transactionally without changing session or set IDs", async () => {
  const old = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("prime-fitness-workouts", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("workouts");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const draft = {
    version: 1,
    userId: "upgrade-member",
    session: {
      id: "existing-session",
      member_id: "upgrade-member",
      started_at: "2026-10-20T10:00:00Z",
      title: "Existing",
      synced: false,
    },
    exercises: [],
    sets: [
      {
        id: "existing-set",
        session_id: "existing-session",
        member_id: "upgrade-member",
        exercise_id: "existing-exercise",
        set_number: 1,
        reps: 10,
        weight_kg: 40,
        rpe: 8,
        created_at: "2026-10-20T10:00:00Z",
        sync: "pending",
      },
    ],
    plan: [],
    superset: [],
    notes: "Keep these notes",
    restEnd: 123,
    phase: "active",
    finishedAt: null,
    error: null,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = old.transaction("workouts", "readwrite");
    tx.objectStore("workouts").put(draft, "upgrade-member");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  old.close();
  expect((await readWorkout("upgrade-member")).session).toBeNull();
  expect((await readLegacyWorkout("upgrade-member"))?.session?.id).toBe("existing-session");
  await adoptLegacyWorkout("upgrade-member");
  const next = await readWorkout("upgrade-member");
  expect(await readLegacyWorkout("upgrade-member")).toBeNull();
  expect(next).toMatchObject({
    version: 2,
    session: { id: "existing-session" },
    notes: "Keep these notes",
    restEnd: 123,
  });
  expect(next.sets[0]).toMatchObject({
    id: "existing-set",
    set_role: "working",
    side: "bilateral",
    logging_mode: "weighted_reps",
    sync: "pending",
  });
});
