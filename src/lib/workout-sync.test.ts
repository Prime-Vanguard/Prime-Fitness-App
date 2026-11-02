import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import { appendSet, changeWorkout, emptyWorkout, readWorkout } from "./workout-store";
import { deleteWorkoutSets, editWorkoutSet, restoreWorkoutSets } from "./workout-editor";
const mock = vi.hoisted(() => ({
  user: "",
  writes: [] as Record<string, unknown>[],
  accept: true,
  onWrite: null as (() => Promise<void>) | null,
  onDelete: null as (() => Promise<void>) | null,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: mock.user } } } }) },
    from: (table: string) => {
      let row: Record<string, unknown> = {},
        operation = "read";
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        maybeSingle: async () => ({ data: { id: "session", finished_at: null }, error: null }),
        upsert: (value: Record<string, unknown>) => {
          row = value;
          operation = "write";
          return query;
        },
        delete: () => {
          operation = "delete";
          return query;
        },
        abortSignal: () => {
          if (table !== "set_logs") return query;
          return (async () => {
            if (operation === "write") {
              mock.writes.push(row);
              const callback = mock.onWrite;
              mock.onWrite = null;
              await callback?.();
              return { data: mock.accept ? [{ id: row["id"] }] : [], error: null };
            }
            const callback = mock.onDelete;
            mock.onDelete = null;
            await callback?.();
            return { data: [], error: null };
          })();
        },
      };
      return query;
    },
  },
}));
import { syncWorkout } from "./workout-sync";
beforeEach(() => {
  mock.user = crypto.randomUUID();
  mock.writes = [];
  mock.accept = true;
  mock.onWrite = null;
  mock.onDelete = null;
});
async function seed() {
  return changeWorkout(mock.user, () =>
    appendSet(
      {
        ...emptyWorkout(mock.user),
        session: {
          id: "session",
          member_id: mock.user,
          title: "Test",
          started_at: new Date().toISOString(),
          synced: true,
        },
      },
      { exercise_id: "bench", reps: 5, weight_kg: 50, rpe: null },
    ),
  );
}
it("sends a newer edit after an older write completes and never sends local bookkeeping", async () => {
  const w = await seed(),
    row = w.sets[0]!;
  mock.onWrite = async () => {
    await changeWorkout(mock.user, (c) =>
      editWorkoutSet(c, row["id"], 0, { reps: 8, weight_kg: 55, rpe: 8 }),
    );
  };
  await syncWorkout(mock.user);
  expect(mock.writes.map((r) => r["reps"])).toEqual([5, 8]);
  expect(mock.writes.every((r) => !("localRevision" in r) && !("sync" in r))).toBe(true);
  expect((await readWorkout(mock.user)).sets[0]).toMatchObject({ reps: 8, sync: "synced" });
});
it("retains a write when RLS accepts no row", async () => {
  await seed();
  mock.accept = false;
  await syncWorkout(mock.user);
  expect((await readWorkout(mock.user)).sets[0]?.sync).toBe("pending");
  expect((await readWorkout(mock.user)).error).toContain("not accepted");
});
it("replays an undo made while its deletion acknowledgement was in flight", async () => {
  const w = await seed(),
    row = w.sets[0]!;
  await changeWorkout(mock.user, (c) => deleteWorkoutSets(c, row["id"]));
  mock.onDelete = async () => {
    await changeWorkout(mock.user, (c) => restoreWorkoutSets(c, [row]));
  };
  await syncWorkout(mock.user);
  expect(mock.writes.map((r) => r["id"])).toEqual([row["id"]]);
  expect((await readWorkout(mock.user)).sets[0]?.sync).toBe("synced");
});
