import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import {
  appendSet,
  changeWorkout,
  emptyWorkout,
  readWorkout,
  readLegacyWorkout,
  adoptLegacyWorkout,
} from "./workout-store";
import { initializePlannedRows, completePlannedRow, slotDraftKey } from "./workout-editor";
const seed = async (id: string) =>
  changeWorkout(id, () => ({
    ...emptyWorkout(id),
    session: {
      id: "session",
      member_id: id,
      started_at: new Date().toISOString(),
      title: "Workout",
      synced: false,
    },
  }));
describe("durable workout storage", () => {
  it("retains both drafts when legacy recovery would overwrite an active project workout", async () => {
    const user = crypto.randomUUID();
    await seed(user);
    const d = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("prime-fitness-workouts", 3);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction("workouts", "readwrite");
      tx.objectStore("workouts").put({ ...emptyWorkout(user), notes: "Legacy notes" }, user);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    d.close();
    await expect(adoptLegacyWorkout(user)).rejects.toThrow("current project draft");
    expect((await readLegacyWorkout(user))?.notes).toBe("Legacy notes");
    expect((await readWorkout(user)).session?.title).toBe("Workout");
  });
  it("isolates the same member UUID across backend projects", async () => {
    const user = crypto.randomUUID();
    const originalProject = import.meta.env["VITE_SUPABASE_URL"];
    try {
      vi.stubEnv("VITE_SUPABASE_URL", "https://project-a.supabase.co");
      await changeWorkout(user, (w) => ({ ...w, notes: "Project A draft" }));
      vi.stubEnv("VITE_SUPABASE_URL", "https://project-b.supabase.co");
      expect((await readWorkout(user)).notes).toBe("");
      await changeWorkout(user, (w) => ({ ...w, notes: "Project B draft" }));
      vi.stubEnv("VITE_SUPABASE_URL", "https://project-a.supabase.co");
      expect((await readWorkout(user)).notes).toBe("Project A draft");
    } finally {
      vi.stubEnv("VITE_SUPABASE_URL", originalProject);
    }
  });
  it("atomically completes a shared planned row once across concurrent tabs", async () => {
    const user = "planned-concurrency";
    await seed(user);
    const w = await changeWorkout(user, (current) =>
      initializePlannedRows(
        {
          ...current,
          exercises: [
            { id: "bench", name_en: "Bench", name_ar: null, muscle: "chest", equipment: "barbell" },
          ],
          plan: [{ id: "bench", slot_key: "slot", sets: 1, reps: "8" }],
        },
        "bench",
        "slot",
        { reps: "8", weight: "50", rpe: "", units: "metric" },
      ),
    );
    const row = w.editor!.plannedRows![slotDraftKey("bench", "slot")]![0]!;
    const result = await Promise.allSettled(
      [0, 1].map(() =>
        changeWorkout(user, (current) =>
          completePlannedRow(current, "bench", "slot", row.id, row.draft, "metric"),
        ),
      ),
    );
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(result.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect((await readWorkout(user)).sets).toHaveLength(1);
  });
  it("serializes concurrent writes without losing sets or reusing IDs", async () => {
    await seed("concurrent");
    await Promise.all(
      Array.from({ length: 12 }, () =>
        changeWorkout("concurrent", (w) =>
          appendSet(w, { exercise_id: "squat", reps: 5, weight_kg: 100, rpe: 8 }),
        ),
      ),
    );
    const w = await readWorkout("concurrent");
    expect(w.sets).toHaveLength(12);
    expect(new Set(w.sets.map((s) => s.id)).size).toBe(12);
    expect(w.sets.map((s) => s.set_number)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });
  it("isolates users and preserves drafts through a fresh read", async () => {
    await seed("member-a");
    await changeWorkout("member-a", (w) => ({
      ...w,
      notes: "Saved while offline",
      restEnd: 1234,
      superset: ["a", "b"],
    }));
    expect(await readWorkout("member-b")).toEqual(emptyWorkout("member-b"));
    expect(await readWorkout("member-a")).toMatchObject({
      notes: "Saved while offline",
      restEnd: 1234,
      superset: ["a", "b"],
    });
  });
  it("keeps the previous committed draft when a transaction fails", async () => {
    await seed("failure");
    await expect(
      changeWorkout("failure", () => {
        throw new Error("quota simulation");
      }),
    ).rejects.toThrow();
    expect((await readWorkout("failure")).session?.id).toBe("session");
  });
  it("rejects invalid logs and freezes logs after finish is requested", async () => {
    const w = await seed("validation");
    expect(() => appendSet(w, { exercise_id: "a", reps: -1, weight_kg: 10, rpe: null })).toThrow();
    expect(() =>
      appendSet(
        { ...w, phase: "finishing" },
        { exercise_id: "a", reps: 5, weight_kg: 10, rpe: null },
      ),
    ).toThrow();
  });
});
