import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(), auth: { getSession: vi.fn() } },
}));
import { supabase } from "@/integrations/supabase/client";
import {
  readRedemptionIntents,
  reserveRedemptionIntent,
  repriceRedemptionIntent,
  sendRedemptionIntent,
} from "./redemption-intents";
let user: string, reward: string;
beforeEach(() => {
  vi.resetAllMocks();
  user = crypto.randomUUID();
  reward = crypto.randomUUID();
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: user } } },
  } as never);
});
const response = (data: unknown, error: unknown = null) =>
  ({ abortSignal: () => Promise.resolve({ data, error }) }) as never;
it("reserves one durable intent for simultaneous tabs and isolates members", async () => {
  const [a, b] = await Promise.all([
    reserveRedemptionIntent(user, reward, 10, "Reward"),
    reserveRedemptionIntent(user, reward, 10, "Reward"),
  ]);
  expect(a.id).toBe(b.id);
  expect(await readRedemptionIntents(user)).toHaveLength(1);
  expect(await readRedemptionIntents(crypto.randomUUID())).toEqual([]);
});
it("keeps the UUID through an uncertain response and retires it only after a receipt", async () => {
  const intent = await reserveRedemptionIntent(user, reward, 10, "Reward");
  vi.mocked(supabase.rpc).mockReturnValueOnce(response(null, { message: "Connection lost" }));
  await expect(sendRedemptionIntent(user, intent)).rejects.toMatchObject({
    message: "Connection lost",
  });
  const saved = (await readRedemptionIntents(user))[0]!;
  expect(saved.id).toBe(intent.id);
  vi.mocked(supabase.rpc).mockReturnValueOnce(
    response({ id: intent.id, member_id: user, reward_id: reward, status: "pending" }),
  );
  await sendRedemptionIntent(user, saved);
  expect(await readRedemptionIntents(user)).toEqual([]);
  expect(supabase.rpc).toHaveBeenLastCalledWith("request_redemption", {
    _member: user,
    _request: intent.id,
    _reward: reward,
    _expected_cost: 10,
  });
  const again = await reserveRedemptionIntent(user, reward, 10, "Reward");
  expect(again.id).not.toBe(intent.id);
});
it("does not submit a request when device persistence fails", async () => {
  const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
    throw new DOMException("Full", "QuotaExceededError");
  });
  await expect(reserveRedemptionIntent(user, reward, 10, "Reward")).rejects.toThrow();
  expect(supabase.rpc).not.toHaveBeenCalled();
  spy.mockRestore();
});
it("blocks an account switch and retains the prior account's intent", async () => {
  const intent = await reserveRedemptionIntent(user, reward, 10, "Reward");
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: crypto.randomUUID() } } },
  } as never);
  await expect(sendRedemptionIntent(user, intent)).rejects.toThrow("Sign in");
  expect(supabase.rpc).not.toHaveBeenCalled();
  expect(await readRedemptionIntents(user)).toHaveLength(1);
});
it("reprices the same request without creating a second purchase identity", async () => {
  const intent = await reserveRedemptionIntent(user, reward, 10, "Reward");
  await repriceRedemptionIntent(user, intent.id, 12);
  expect(await readRedemptionIntents(user)).toEqual([
    expect.objectContaining({ id: intent.id, cost: 12 }),
  ]);
});
