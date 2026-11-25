import "fake-indexeddb/auto";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
import { supabase } from "@/integrations/supabase/client";
import { changeMemberState } from "@/lib/member-store";
import { useMe } from "./use-me";
import { readOfflineProfile } from "@/lib/offline-profile-cache";
import * as offlineProfileCache from "@/lib/offline-profile-cache";

afterEach(() => {
  vi.restoreAllMocks();
});
function mount(id: string) {
  const client = new QueryClient();
  const hook = renderHook(() => useMe(id), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { ...hook, client };
}
it("restores paused/onboarding state offline without granting cached staff roles", async () => {
  const id = crypto.randomUUID();
  await changeMemberState(id, (s) => ({
    ...s,
    references: {
      offlineProfile: {
        profile: { id, access_active: false, onboarding_completed: true },
        verifiedAt: new Date().toISOString(),
      },
    },
  }));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  const { result, unmount, client } = mount(id);
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.profile?.access_active).toBe(false);
  expect(result.current.data?.roles).toEqual([]);
  expect(result.current.data?.isAdmin).toBe(false);
  unmount();
  client.clear();
});
it("does not restore another member's profile", async () => {
  const id = crypto.randomUUID();
  await changeMemberState(id, (s) => ({
    ...s,
    references: { offlineProfile: { profile: { id: "other" } } },
  }));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  const { result, unmount, client } = mount(id);
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
  unmount();
  client.clear();
});
it("does not fall back to cached data after a permission rejection", async () => {
  const id = crypto.randomUUID();
  await changeMemberState(id, (s) => ({
    ...s,
    references: { offlineProfile: { profile: { id } } },
  }));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const response = Promise.resolve({ data: null, error: { code: "42501", message: "denied" } });
  vi.mocked(supabase.from).mockReturnValue({
    select: () => ({ eq: () => Object.assign(response, { maybeSingle: () => response }) }),
  } as never);
  const { result, unmount, client } = mount(id);
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
  unmount();
  client.clear();
});

function mockMemberReads(
  profile: unknown,
  roles: PromiseLike<unknown> = Promise.resolve({ data: [{ role: "member" }], error: null }),
) {
  vi.mocked(supabase.from).mockImplementation(
    (table: string) =>
      ({
        select: () => ({
          eq: () =>
            table === "profiles"
              ? {
                  maybeSingle: () => Promise.resolve({ data: profile, error: null }),
                }
              : roles,
        }),
      }) as never,
  );
}

it.each([false, null])(
  "records a paused or missing profile while role loading hangs: %s",
  async (active) => {
    const memberId = crypto.randomUUID();
    await changeMemberState(memberId, (state) => ({
      ...state,
      references: {
        offlineProfile: {
          profile: { id: memberId, access_active: true, onboarding_completed: true },
          verifiedAt: new Date().toISOString(),
        },
      },
    }));
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    let resolveRoles!: (value: unknown) => void;
    const roles = new Promise((resolve) => {
      resolveRoles = resolve;
    });
    mockMemberReads(
      active === null ? null : { id: memberId, access_active: active, onboarding_completed: true },
      roles,
    );
    const { result, unmount, client } = mount(memberId);
    try {
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.profile?.access_active ?? null).toBe(active);
      if (active === null) await expect(readOfflineProfile(memberId)).rejects.toThrow();
      else expect((await readOfflineProfile(memberId)).access_active).toBe(false);
    } finally {
      resolveRoles({ data: [], error: null });
      unmount();
      client.clear();
    }
  },
);

it("keeps online access but reports failed offline preparation", async () => {
  const memberId = crypto.randomUUID();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.spyOn(offlineProfileCache, "saveOfflineProfile").mockResolvedValue(false);
  mockMemberReads({ id: memberId, access_active: true, onboarding_completed: true });
  const { result, unmount, client } = mount(memberId);
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.profile?.id).toBe(memberId);
  expect(result.current.data?.offlineAccountPrepared).toBe(false);
  unmount();
  client.clear();
});

it.each([
  { version: 2, profile: { access_active: true, onboarding_completed: true } },
  { version: 1, profile: { access_active: "true", onboarding_completed: true } },
  { version: 1, profile: { access_active: true } },
])("rejects unsupported or malformed cached safety fields: %j", async (snapshot) => {
  const memberId = crypto.randomUUID();
  await changeMemberState(memberId, (state) => ({
    ...state,
    references: {
      offlineProfile: {
        ...snapshot,
        profile: { id: memberId, ...snapshot.profile },
        verifiedAt: new Date().toISOString(),
      },
    },
  }));
  await expect(readOfflineProfile(memberId)).rejects.toThrow();
});

it("marks roles unconfirmed after a connection failure instead of treating them as none", async () => {
  const memberId = crypto.randomUUID();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  mockMemberReads(
    { id: memberId, access_active: true, onboarding_completed: true },
    Promise.reject(new TypeError("Failed to fetch")),
  );
  const { result, unmount, client } = mount(memberId);
  try {
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isAdmin).toBe(false);
    expect(result.current.data?.rolesUnavailable).toBe(true);
  } finally {
    unmount();
    client.clear();
  }
});
