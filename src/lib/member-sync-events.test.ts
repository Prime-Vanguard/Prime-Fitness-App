import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(), auth: { getSession: vi.fn() } },
}));
import { supabase } from "@/integrations/supabase/client";
import {
  queueMemberWrites,
  readMemberState,
  syncMemberEntries,
  watchMemberSync,
} from "./member-store";

let user: string;
let receive: ((event: { data: unknown }) => void) | null = null;
const messages: unknown[] = [];
vi.stubGlobal(
  "BroadcastChannel",
  class {
    set onmessage(callback: typeof receive) {
      receive = callback;
    }
    get onmessage() {
      return receive;
    }
    postMessage(data: unknown) {
      messages.push(data);
    }
  },
);
beforeEach(() => {
  vi.resetAllMocks();
  messages.length = 0;
  user = crypto.randomUUID();
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: user } } },
    error: null,
  } as never);
});
type Mutation = {
  id: string;
  record_id: string;
  payload: Record<string, unknown>;
  base_revision: number;
};
function success(rows: Mutation[]) {
  return rows.map((row) => ({
    id: row.id,
    status: "applied",
    record: { ...row.payload, revision: row.base_revision + 1 },
    revision: row.base_revision + 1,
  }));
}
function respond(make: (rows: Mutation[]) => { data: unknown; error: unknown }) {
  vi.mocked(supabase.rpc).mockImplementation(
    (_name, args) =>
      ({
        abortSignal: async () => make((args as unknown as { _mutations: Mutation[] })._mutations),
      }) as never,
  );
}
async function queue() {
  await queueMemberWrites(user, [
    { entity: "water_logs", op: "put", record: { id: crypto.randomUUID(), ml: 250 } },
  ]);
}
it("does not announce a no-op flush", async () => {
  const accepted = vi.fn(),
    stop = watchMemberSync(user, accepted);
  try {
    await syncMemberEntries(user);
    expect(accepted).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  } finally {
    stop();
  }
});
it("announces multiple acknowledged groups once, without record data", async () => {
  await queue();
  await queue();
  respond((rows) => ({ data: success(rows), error: null }));
  const accepted = vi.fn(),
    other = vi.fn();
  const stop = watchMemberSync(user, accepted),
    stopOther = watchMemberSync(crypto.randomUUID(), other);
  try {
    await syncMemberEntries(user);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(accepted).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    expect((await readMemberState(user)).queue).toHaveLength(0);
    expect(messages.filter((message) => typeof message === "object" && message !== null)).toEqual([
      { type: "member-sync-accepted", scope: `${import.meta.env["VITE_SUPABASE_URL"]}:${user}` },
    ]);
  } finally {
    stop();
    stopOther();
  }
});
it.each(["network", "malformed", "conflict"])(
  "does not announce an unaccepted %s response",
  async (mode) => {
    await queue();
    respond((rows) =>
      mode === "network"
        ? { data: null, error: { code: "503", message: "Retry" } }
        : mode === "malformed"
          ? { data: [], error: null }
          : { data: [{ ...success(rows)[0], status: "conflict" }], error: null },
    );
    const accepted = vi.fn(),
      stop = watchMemberSync(user, accepted);
    try {
      await syncMemberEntries(user);
      expect(accepted).not.toHaveBeenCalled();
      expect((await readMemberState(user)).queue).toHaveLength(1);
    } finally {
      stop();
    }
  },
);
it("announces accepted work even when a later group fails", async () => {
  await queue();
  await queue();
  let calls = 0;
  respond((rows) =>
    ++calls === 1
      ? { data: success(rows), error: null }
      : { data: null, error: { code: "503", message: "Retry" } },
  );
  const accepted = vi.fn(),
    stop = watchMemberSync(user, accepted);
  try {
    await syncMemberEntries(user);
    expect(accepted).toHaveBeenCalledTimes(1);
    expect((await readMemberState(user)).queue).toHaveLength(1);
  } finally {
    stop();
  }
});
it("filters peer notices by project/member and removes unsubscribed observers", () => {
  const accepted = vi.fn(),
    other = vi.fn(),
    otherUser = crypto.randomUUID();
  const stop = watchMemberSync(user, accepted),
    stopOther = watchMemberSync(otherUser, other);
  const emit = (scope: unknown) => receive?.({ data: { type: "member-sync-accepted", scope } });
  emit(`other-project:${user}`);
  emit({ payload: "invalid" });
  expect(accepted).not.toHaveBeenCalled();
  emit(`${import.meta.env["VITE_SUPABASE_URL"]}:${user}`);
  expect(accepted).toHaveBeenCalledTimes(1);
  expect(other).not.toHaveBeenCalled();
  stop();
  emit(`${import.meta.env["VITE_SUPABASE_URL"]}:${user}`);
  expect(accepted).toHaveBeenCalledTimes(1);
  stopOther();
});
