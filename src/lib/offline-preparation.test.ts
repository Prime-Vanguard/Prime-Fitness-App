import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn(), rpc: vi.fn() },
}));
vi.mock("./offline-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./offline-access")>()),
  readOfflineIdentity: vi.fn(),
}));
import { supabase } from "@/integrations/supabase/client";
import { readOfflineIdentity } from "./offline-access";
import { personalHistoryCoverage, prepareMemberOfflineData } from "./offline-preparation";
import { changeMemberState, readMemberState, queueMemberWrites } from "./member-store";
import { activityDay, addDays } from "./dates";

let memberId: string;
let failedTable: string | undefined;
let onWaterRead: (() => Promise<void>) | undefined;
let remoteOwner: string;
const waterId = crypto.randomUUID();
beforeEach(() => {
  vi.resetAllMocks();
  memberId = crypto.randomUUID();
  remoteOwner = memberId;
  failedTable = undefined;
  onWaterRead = undefined;
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.mocked(readOfflineIdentity).mockReturnValue({ id: memberId });
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: memberId } },
    error: null,
  } as never);
  vi.mocked(supabase.rpc).mockReturnValue({
    abortSignal: () => Promise.resolve({ data: { offline: true }, error: null }),
  } as never);
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    let offset = 0;
    let from = "";
    let to = "";
    const query = {
      select: () => query,
      eq: () => query,
      gte: (_column: string, value: string) => {
        from = value;
        return query;
      },
      lte: (_column: string, value: string) => {
        to = value;
        return query;
      },
      order: () => query,
      abortSignal: () => query,
      maybeSingle: () => query,
      range: (first: number) => {
        offset = first;
        return query;
      },
      then: (resolve: (response: unknown) => unknown, reject: (error: unknown) => unknown) =>
        (async () => {
          if (table === "water_logs" && offset === 0 && onWaterRead) {
            const callback = onWaterRead;
            onWaterRead = undefined;
            await callback();
          }
          if (table === failedTable) return { data: null, error: { message: "Download failed" } };
          const waterDate = addDays(activityDay(), -20);
          const data =
            table === "profiles"
              ? { access_active: true }
              : table === "nutrition_targets"
                ? { member_id: memberId, water_ml: 2500 }
                : table === "water_logs" && offset === 0 && waterDate >= from && waterDate <= to
                  ? [
                      {
                        id: waterId,
                        member_id: remoteOwner,
                        log_date: waterDate,
                        ml: 250,
                        revision: 1,
                      },
                    ]
                  : [];
          return { data, error: null };
        })().then(resolve, reject),
    };
    return query as never;
  });
});
afterEach(() => vi.restoreAllMocks());

it("downloads 30 days atomically, retaining pending edits and other private references", async () => {
  await queueMemberWrites(memberId, [
    { entity: "water_logs", op: "put", record: { id: waterId, ml: 500, log_date: activityDay() } },
  ]);
  await changeMemberState(memberId, (state) => ({
    ...state,
    references: { ...state.references, unrelated: "retained" },
  }));
  const manifest = await prepareMemberOfflineData(memberId);
  const saved = await readMemberState(memberId);
  expect(manifest.from).toBe(addDays(activityDay(), -29));
  expect(saved.references["offlinePreparation"]).toEqual(manifest);
  expect(saved.references["unrelated"]).toBe("retained");
  expect(saved.records.water_logs?.[0]?.["ml"]).toBe(500);
  expect(saved.queue).toHaveLength(1);
});
it("retains a downloaded record from twenty days ago", async () => {
  await prepareMemberOfflineData(memberId);
  expect((await readMemberState(memberId)).records.water_logs?.[0]?.id).toBe(waterId);
});

it("refreshes only the requested dates, keeps recent records and pending deletions, and drops undownloaded rows", async () => {
  await prepareMemberOfflineData(memberId);
  const initial = await readMemberState(memberId);
  const recent = initial.records.water_logs![0]!;
  const old = { from: "2020-01-01", to: "2020-01-31" };
  const deletedId = crypto.randomUUID();
  await changeMemberState(memberId, (state) => ({
    ...state,
    records: {
      ...state.records,
      water_logs: [
        { ...recent, id: crypto.randomUUID(), log_date: "2020-01-03" },
        { ...recent, id: deletedId, log_date: "2020-01-05" },
        { ...recent, id: crypto.randomUUID(), log_date: "2021-01-01" },
        recent,
      ],
    },
  }));
  await queueMemberWrites(memberId, [
    { entity: "water_logs", op: "delete", record: { id: deletedId, log_date: "2020-01-05" } },
  ]);
  // The recent fixture is outside the requested range. A successful empty result
  // clears stale rows inside that range while preserving the rest.
  await prepareMemberOfflineData(memberId, old);
  const saved = await readMemberState(memberId);
  // 2021-01-01 lies outside every downloaded range, so it is no longer kept.
  expect(saved.records.water_logs?.map((row) => row.log_date)).toEqual([recent.log_date]);
  expect(saved.queue.map((entry) => entry.record_id)).toEqual([deletedId]);
  expect(saved.references["offlinePreparation"]).toEqual(initial.references["offlinePreparation"]);
  expect(personalHistoryCoverage(saved, memberId)).toEqual([
    old,
    { from: addDays(activityDay(), -29), to: activityDay() },
  ]);
});
it("does not publish a manifest or replace caches when any download fails", async () => {
  failedTable = "wellness_checkins";
  await changeMemberState(memberId, (state) => ({
    ...state,
    references: { targets: { water_ml: 1000 } },
  }));
  await expect(prepareMemberOfflineData(memberId)).rejects.toThrow();
  const saved = await readMemberState(memberId);
  expect(saved.references.targets).toEqual({ water_ml: 1000 });
  expect(saved.references["offlinePreparation"]).toBeUndefined();
  expect(saved.records.water_logs).toBeUndefined();
});
it("preserves local changes made while downloading and asks for a retry", async () => {
  onWaterRead = () =>
    queueMemberWrites(memberId, [
      { entity: "water_logs", op: "put", record: { id: crypto.randomUUID(), ml: 100 } },
    ]).then(() => {});
  await expect(prepareMemberOfflineData(memberId)).rejects.toThrow("Local records changed");
  expect((await readMemberState(memberId)).queue).toHaveLength(1);
  expect((await readMemberState(memberId)).references["offlinePreparation"]).toBeUndefined();
});
it("rejects foreign records and an account change during preparation", async () => {
  remoteOwner = "other";
  await expect(prepareMemberOfflineData(memberId)).rejects.toThrow("ownership");
  remoteOwner = memberId;
  onWaterRead = async () => {
    vi.mocked(readOfflineIdentity).mockReturnValue({ id: "other" });
  };
  await expect(prepareMemberOfflineData(memberId)).rejects.toThrow("same signed-in account");
  expect((await readMemberState(memberId)).references["offlinePreparation"]).toBeUndefined();
});
