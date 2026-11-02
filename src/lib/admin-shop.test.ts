import { beforeEach, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("./admin-member-write", () => ({ requireActiveAdmin: vi.fn() }));
import { supabase } from "@/integrations/supabase/client";
import { requireActiveAdmin } from "./admin-member-write";
import {
  rewardInput,
  shopSearch,
  createReward,
  changeRewardVisibility,
  reviewRedemption,
  loadRedemptions,
  type Reward,
  type Redemption,
} from "./admin-shop";
import { analyticsSearch } from "./admin-analytics";
const reward: Reward = {
  id: "reward",
  title_en: "Coach call",
  title_ar: null,
  cost_pv: 50,
  stock: 2,
  active: true,
  created_by: "admin",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  description: null,
};
const order: Redemption = {
  id: "order",
  reward_id: reward.id,
  member_id: "member",
  cost_pv: 50,
  status: "pending",
  review_note: null,
  reviewed_by: null,
  reviewed_at: null,
  created_at: reward.created_at,
};
const receipt = {
  ...order,
  status: "rejected",
  review_note: "Unavailable",
  reviewed_by: "admin",
  reviewed_at: "2026-10-30T12:00:00Z",
};
const form = { title_en: "Coach call", title_ar: "", cost: "50", stock: "2" };
function mock(...results: { data: unknown; error: unknown }[]) {
  const ops: unknown[][] = [];
  vi.mocked(supabase.from).mockImplementation((table) => {
    const result = results.shift();
    if (!result) throw new Error(`Unexpected ${table}`);
    const query: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    for (const method of [
      "select",
      "eq",
      "is",
      "update",
      "insert",
      "single",
      "maybeSingle",
      "range",
      "order",
      "abortSignal",
      "retry",
    ])
      query[method] = (...args: unknown[]) => {
        ops.push([method, ...args]);
        return query;
      };
    return query as never;
  });
  return ops;
}
const ok = (data: unknown) => ({ data, error: null });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireActiveAdmin).mockResolvedValue(false);
});
it("distinguishes unlimited stock and zero and accepts localized whole numbers", () => {
  expect(rewardInput({ ...form, cost: "٥٠", stock: "٠" })).toMatchObject({ cost_pv: 50, stock: 0 });
  expect(rewardInput({ ...form, stock: "" }).stock).toBeNull();
  for (const cost of ["0", "1x", "1.5", "2147483648"])
    expect(() => rewardInput({ ...form, cost })).toThrow();
  for (const stock of ["-1", "2x", "2.5"]) expect(() => rewardInput({ ...form, stock })).toThrow();
});
it("filters fulfillment on the server so pending requests do not download closed history", async () => {
  const ops = mock(ok([]));
  await loadRedemptions(new AbortController().signal);
  expect(ops).toContainEqual(["eq", "status", "pending"]);
  const all = mock(ok([]));
  await loadRedemptions(new AbortController().signal, "all");
  expect(all.some(([method]) => method === "eq")).toBe(false);
});
it("bounds validated shop and analytics URL state", () => {
  expect(shopSearch({ section: "invalid", status: "approved", page: -2 })).toMatchObject({
    section: undefined,
    status: undefined,
    page: undefined,
  });
  expect(analyticsSearch({ access: "bad", sort: "bad", page: 1.5, audit: "true" })).toMatchObject({
    access: undefined,
    sort: undefined,
    page: undefined,
    audit: true,
  });
});
it("reconciles a lost creation acknowledgement even after a member consumes stock", async () => {
  const ops = mock(ok({ ...reward, stock: 1 })),
    dispatch = vi.fn();
  expect(await createReward("admin", reward.id, form, dispatch)).toMatchObject({ stock: 1 });
  expect(dispatch).not.toHaveBeenCalled();
  expect(ops.some(([op]) => op === "insert")).toBe(false);
});
it("requires a creation receipt and keeps the dispatched request retryable", async () => {
  const dispatch = vi.fn();
  mock(ok(null), ok(null));
  await expect(createReward("admin", reward.id, form, dispatch)).rejects.toThrow("not confirmed");
  expect(dispatch).toHaveBeenCalledOnce();
});
it("refuses stale reward edits without sending an update", async () => {
  const ops = mock(ok({ ...reward, updated_at: "new" }));
  await expect(changeRewardVisibility("admin", reward)).rejects.toThrow("Reward changed");
  expect(ops.some(([op]) => op === "update")).toBe(false);
});
it("does not report a zero-row visibility update as saved", async () => {
  mock(ok(reward), ok(null));
  await expect(changeRewardVisibility("admin", reward)).rejects.toThrow("not confirmed");
});
it("requires a rejection reason before dispatch", async () => {
  await expect(reviewRedemption("admin", order, "rejected", " ")).rejects.toThrow(
    "rejection reason",
  );
  expect(supabase.from).not.toHaveBeenCalled();
});
it("accepts the same actor's durable decision receipt without a second refund update", async () => {
  const ops = mock(ok(receipt));
  expect(await reviewRedemption("admin", order, "rejected", "Unavailable")).toEqual(receipt);
  expect(ops.some(([op]) => op === "update")).toBe(false);
});
it("cannot reinterpret another administrator's decision as this request's acknowledgement", async () => {
  const ops = mock(ok({ ...receipt, reviewed_by: "other" }));
  await expect(reviewRedemption("admin", order, "rejected", "Unavailable")).rejects.toThrow(
    "already reviewed",
  );
  expect(ops.some(([op]) => op === "update")).toBe(false);
});
it("rejects changed review notes and zero-row decisions", async () => {
  mock(ok({ ...order, review_note: "Changed" }));
  await expect(reviewRedemption("admin", order, "fulfilled", "")).rejects.toThrow(
    "Request changed",
  );
  mock(ok(order), ok(null));
  await expect(reviewRedemption("admin", order, "fulfilled", "")).rejects.toThrow(
    "receipt was not confirmed",
  );
});
it("checks the server actor and timestamp before confirming a financial decision", async () => {
  mock(ok(order), ok({ ...receipt, reviewed_at: null }));
  await expect(reviewRedemption("admin", order, "rejected", "Unavailable")).rejects.toThrow(
    "receipt was not confirmed",
  );
});
it("freshly withdrawn access blocks all shop mutations", async () => {
  vi.mocked(requireActiveAdmin).mockRejectedValue(new Error("Paused"));
  await expect(reviewRedemption("admin", order, "fulfilled", "")).rejects.toThrow("Paused");
  await expect(createReward("admin", reward.id, form, vi.fn())).rejects.toThrow("Paused");
  await expect(changeRewardVisibility("admin", reward)).rejects.toThrow("Paused");
  expect(supabase.from).not.toHaveBeenCalled();
});
