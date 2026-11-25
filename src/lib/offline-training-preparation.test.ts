import "fake-indexeddb/auto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));
vi.mock("./training-assignment", () => ({ loadAssignedTraining: vi.fn() }));
vi.mock("./offline-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./offline-access")>()),
  readOfflineIdentity: vi.fn(),
}));
import { supabase } from "@/integrations/supabase/client";
import { readOfflineIdentity } from "./offline-access";
import { loadAssignedTraining } from "./training-assignment";
import { prepareTrainingOfflineData } from "./offline-training-preparation";
import { changeWorkout, readWorkout } from "./workout-store";
import { readMemberState } from "./member-store";
let memberId: string;
beforeEach(() => {
  vi.resetAllMocks();
  memberId = crypto.randomUUID();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.mocked(readOfflineIdentity).mockReturnValue({ id: memberId });
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: memberId } },
    error: null,
  } as never);
  vi.mocked(loadAssignedTraining).mockResolvedValue(null);
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    let offset = 0;
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      abortSignal: () => query,
      maybeSingle: () => query,
      range: (start: number) => {
        offset = start;
        return query;
      },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve({
          error: null,
          data:
            table === "profiles"
              ? { access_active: true }
              : offset
                ? []
                : [
                    {
                      id: "exercise",
                      name_en: "New catalogue name",
                      name_ar: null,
                      muscle: "quads",
                      equipment: null,
                    },
                  ],
        }).then(resolve, reject),
    };
    return query as never;
  });
});
afterEach(() => vi.restoreAllMocks());
it("refreshes catalogue data while preserving active drafts and frozen exercise names", async () => {
  const sessionId = crypto.randomUUID();
  await changeWorkout(memberId, (workout) => ({
    ...workout,
    session: {
      id: sessionId,
      member_id: memberId,
      title: "Unsynced session",
      started_at: new Date().toISOString(),
      synced: false,
    },
    notes: "Private pending notes",
    phase: "finishing",
    plan: [
      {
        id: "exercise",
        sets: 3,
        reps: "8",
        exercise: {
          id: "exercise",
          name_en: "Frozen name",
          name_ar: null,
          muscle: "quads",
          equipment: null,
        },
      },
    ],
  }));
  const original = await readWorkout(memberId);
  await prepareTrainingOfflineData(memberId);
  const updated = await readWorkout(memberId);
  expect({ ...updated, exercises: [] }).toEqual({ ...original, exercises: [] });
  expect(updated.exercises[0]?.name_en).toBe("Frozen name");
  expect(vi.mocked(loadAssignedTraining)).toHaveBeenCalledWith(memberId, true);
  expect((await readMemberState(memberId)).references["trainingPreparation"]).toMatchObject({
    exerciseCount: 1,
  });
});
it("keeps drafts and withholds the completion manifest on failed program downloads", async () => {
  await changeWorkout(memberId, (workout) => ({ ...workout, notes: "Retain me" }));
  vi.mocked(loadAssignedTraining).mockRejectedValue(new Error("Download interrupted"));
  await expect(prepareTrainingOfflineData(memberId)).rejects.toThrow("interrupted");
  expect((await readWorkout(memberId)).notes).toBe("Retain me");
  expect((await readMemberState(memberId)).references["trainingPreparation"]).toBeUndefined();
});
