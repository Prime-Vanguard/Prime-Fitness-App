import "fake-indexeddb/auto";
import { QueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { sessionCacheBoundary } from "./auth-session-cache";
import { changeWorkout, readWorkout } from "./workout-store";

const session = (id: string) => ({ user: { id } }) as Session;
describe("private cache session boundaries", () => {
  it("clears private data on sign out and on direct identity changes", () => {
    const client = new QueryClient();
    const reset = vi.fn();
    const event = sessionCacheBoundary(client, reset);
    event("INITIAL_SESSION", session("A"));
    client.setQueryData(["admin-members", "A"], ["private A"]);
    event("SIGNED_OUT", null);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    event("SIGNED_IN", session("B"));
    client.setQueryData(["admin-members", "B"], ["private B"]);
    event("SIGNED_IN", session("C"));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(reset).toHaveBeenCalledTimes(3);
  });
  it("retains same-user data during ordinary token refresh", () => {
    const client = new QueryClient();
    const reset = vi.fn();
    const event = sessionCacheBoundary(client, reset);
    event("INITIAL_SESSION", session("A"));
    client.setQueryData(["private", "A"], "A");
    event("TOKEN_REFRESHED", session("A"));
    expect(client.getQueryData(["private", "A"])).toBe("A");
    expect(reset).not.toHaveBeenCalled();
    client.clear();
  });
  it("does not let a late request refill a previous identity's cache", async () => {
    const client = new QueryClient();
    const event = sessionCacheBoundary(client, vi.fn());
    event("INITIAL_SESSION", session("A"));
    let complete!: (value: string[]) => void;
    const request = client
      .fetchQuery({
        queryKey: ["private", "A"],
        queryFn: () =>
          new Promise<string[]>((resolve) => {
            complete = resolve;
          }),
      })
      .catch(() => {});
    event("SIGNED_OUT", null);
    event("SIGNED_IN", session("B"));
    complete(["private A"]);
    await request;
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
  it("preserves unsynced member-scoped workout drafts", async () => {
    await changeWorkout("old-member", (draft) => ({ ...draft, notes: "Unsynced workout" }));
    const client = new QueryClient();
    const event = sessionCacheBoundary(client, vi.fn());
    event("INITIAL_SESSION", session("old-member"));
    event("SIGNED_OUT", null);
    expect((await readWorkout("old-member")).notes).toBe("Unsynced workout");
    expect((await readWorkout("new-member")).notes).toBe("");
  });
});
