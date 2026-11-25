import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  profile: {} as Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      let patch: Record<string, unknown> | null = null;
      const query = {
        select: () => query,
        eq: () => query,
        setHeader: () => query,
        abortSignal: () => query,
        update: (values: Record<string, unknown>) => {
          patch = values;
          return query;
        },
        maybeSingle: async () => {
          if (patch) {
            server.updates.push(patch);
            server.profile = { ...server.profile, ...patch, updated_at: "later" };
          }
          return { data: server.profile, error: null, status: 200 };
        },
      };
      return query;
    },
  },
}));
vi.mock("./offline-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./offline-access")>()),
  readOfflineIdentity: vi.fn(),
}));
vi.mock("./queued-sync-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./queued-sync-access")>()),
  authorizeQueuedSync: vi.fn(async () => true),
  queuedSyncAuthorization: vi.fn(async () => "Bearer test"),
}));
import { readOfflineIdentity } from "./offline-access";
import { readMemberState } from "./member-store";
import {
  blockedProfileSettings,
  overlayPendingProfileSettings,
  profileSettingsStatus,
  queueProfileSettings,
  syncProfileSettings,
} from "./offline-profile-settings";

let memberId: string;
const baseline = { display_name: "Sara", units: "metric", locale: "en", leaderboard_opt_in: false };
const profile = () =>
  ({ id: memberId, access_active: true, updated_at: "now", ...baseline }) as never;

beforeEach(() => {
  memberId = crypto.randomUUID();
  server.profile = {
    id: memberId,
    access_active: true,
    onboarding_completed: true,
    updated_at: "now",
    ...baseline,
  };
  server.updates = [];
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.mocked(readOfflineIdentity).mockReturnValue({ id: memberId });
});

it("sends a queued change and clears it once the server holds the value", async () => {
  await queueProfileSettings(memberId, baseline, { locale: "ar" });
  expect((await overlayPendingProfileSettings(profile())).locale).toBe("ar");
  expect(await syncProfileSettings(memberId)).toBe(true);
  expect(server.updates).toEqual([{ locale: "ar" }]);
  expect(profileSettingsStatus(await readMemberState(memberId))).toBeUndefined();
});

it("marks a conflict without writing, and stops showing the blocked values", async () => {
  await queueProfileSettings(memberId, baseline, { locale: "ar" });
  server.profile = { ...server.profile, locale: "fr" }; // changed on another device
  expect(await syncProfileSettings(memberId)).toBe(true);
  expect(server.updates).toEqual([]);
  expect(profileSettingsStatus(await readMemberState(memberId))).toBe("conflict");
  expect((await overlayPendingProfileSettings(profile())).locale).toBe("en");
  expect(blockedProfileSettings(await readMemberState(memberId))).toEqual({ locale: "ar" });
});

it("acknowledges a change whose earlier response was lost without writing again", async () => {
  await queueProfileSettings(memberId, baseline, { units: "imperial" });
  server.profile = { ...server.profile, units: "imperial" };
  expect(await syncProfileSettings(memberId)).toBe(true);
  expect(server.updates).toEqual([]);
  expect(profileSettingsStatus(await readMemberState(memberId))).toBeUndefined();
});
