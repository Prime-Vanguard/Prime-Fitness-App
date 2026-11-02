import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("./admin-member-write", () => ({ requireActiveAdmin: vi.fn() }));
import { supabase } from "@/integrations/supabase/client";
import { requireActiveAdmin } from "./admin-member-write";
import {
  addPodMember,
  changePodLeader,
  createPod,
  loadPodPeople,
  loadPods,
  podSearch,
  removePodMember,
  type Pod,
} from "./admin-pods";

const pod: Pod = {
  id: "pod",
  name: "Prime",
  description: null,
  leader_id: "old",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-29T00:00:00Z",
};
const row = { pod_id: pod.id, member_id: "member", created_at: "2026-10-29T00:00:00Z" };
type Result = { data: unknown; error: unknown };
const ok = (data: unknown): Result => ({ data, error: null });
function mock(pages: Record<string, Result[]>) {
  const ops: unknown[][] = [];
  vi.mocked(supabase.from).mockImplementation((table) => {
    const result = pages[table]?.shift();
    if (!result) throw new Error(`Unexpected ${table} query`);
    const query: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve),
    };
    for (const method of [
      "select",
      "eq",
      "is",
      "insert",
      "delete",
      "update",
      "range",
      "order",
      "abortSignal",
      "retry",
      "in",
    ])
      query[method] = (...args: unknown[]) => {
        ops.push([table, method, ...args]);
        return query;
      };
    query["single"] = query["maybeSingle"] = () => Promise.resolve(result);
    return query as never;
  });
  return ops;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireActiveAdmin).mockResolvedValue(false);
});
it("validates deep links and bounds search/pagination", () => {
  expect(podSearch({ q: "a".repeat(200), page: 1e9, pod: "not-a-uuid" })).toEqual({
    q: "a".repeat(150),
    page: 100000,
  });
  expect(podSearch({ page: -1, pod: "00000000-0000-4000-8000-000000000001" }).pod).toBeTruthy();
});
it("checks current administrator access even on an idempotent retry", async () => {
  vi.mocked(requireActiveAdmin).mockRejectedValue(new Error("Access withdrawn"));
  await expect(createPod("actor", pod)).rejects.toThrow("Access withdrawn");
  expect(supabase.from).not.toHaveBeenCalled();
});
it("reconciles a lost creation acknowledgement without a second insert", async () => {
  const ops = mock({ pods: [ok(pod)] });
  const dispatch = vi.fn();
  await expect(createPod("actor", pod, dispatch)).resolves.toEqual(pod);
  expect(ops.some((op) => op[1] === "insert")).toBe(false);
  expect(dispatch).not.toHaveBeenCalled();
});
it("never overwrites a different saved creation request", async () => {
  mock({ pods: [ok({ ...pod, name: "Different" })] });
  await expect(createPod("actor", pod)).rejects.toThrow("different Pod");
});
it("uses a stable Pod ID, trims the name and requires a matching receipt", async () => {
  const saved = { ...pod, leader_id: null };
  const ops = mock({ pods: [ok(null), ok(saved)] });
  await expect(createPod("actor", { ...saved, name: " Prime " })).resolves.toEqual(saved);
  expect(ops).toContainEqual(["pods", "insert", { id: pod.id, name: "Prime", leader_id: null }]);
  mock({ pods: [ok(null), ok(null)] });
  await expect(createPod("actor", { id: "new", name: "New", leader_id: null })).rejects.toThrow(
    "not confirmed",
  );
});
it("only offers active Pod Leaders for a new leader assignment", async () => {
  const ops = mock({
    pods: [ok(pod)],
    profiles: [ok({ access_active: false })],
    user_roles: [ok({ user_id: "next" })],
  });
  await expect(changePodLeader("actor", pod, "next")).rejects.toThrow("active member");
  expect(ops.some((op) => op[1] === "update")).toBe(false);
});
it("rejects a stale leader draft before issuing an update", async () => {
  const ops = mock({ pods: [ok({ ...pod, leader_id: "other" })] });
  await expect(changePodLeader("actor", pod, null)).rejects.toThrow("another tab");
  expect(ops.some((op) => op[1] === "update")).toBe(false);
});
it("conditions leader changes on Pod, server timestamp and original nullable leader", async () => {
  const baseline = { ...pod, leader_id: null };
  const ops = mock({
    pods: [ok(baseline), ok({ ...pod, leader_id: "next" })],
    profiles: [ok({ access_active: true })],
    user_roles: [ok({ user_id: "next" })],
  });
  await changePodLeader("actor", baseline, "next");
  expect(ops).toContainEqual(["pods", "eq", "updated_at", pod.updated_at]);
  expect(ops).toContainEqual(["pods", "is", "leader_id", null]);
});
it("requires a leader acknowledgement and reconciles already-applied changes", async () => {
  mock({ pods: [ok(pod), ok(null)] });
  await expect(changePodLeader("actor", pod, null)).rejects.toThrow("not confirmed");
  const ops = mock({ pods: [ok({ ...pod, leader_id: null })] });
  await changePodLeader("actor", pod, null);
  expect(ops.some((op) => op[1] === "update")).toBe(false);
});
it("reconciles existing memberships and duplicate concurrent additions", async () => {
  let ops = mock({ pods: [ok(pod)], pod_members: [ok(row)] });
  await addPodMember("actor", pod.id, row.member_id);
  expect(ops.some((op) => op[1] === "insert")).toBe(false);
  ops = mock({
    pods: [ok(pod)],
    pod_members: [ok(null), { data: null, error: { code: "23505" } }, ok(row)],
  });
  await expect(addPodMember("actor", pod.id, row.member_id)).resolves.toEqual(row);
  expect(ops.filter((op) => op[1] === "insert")).toHaveLength(1);
});
it("does not treat an empty member-addition receipt as success", async () => {
  mock({ pods: [ok(pod)], pod_members: [ok(null), ok(null)] });
  await expect(addPodMember("actor", pod.id, row.member_id)).rejects.toThrow("not confirmed");
});
it("removes only the reviewed membership generation and rejects zero-row deletion", async () => {
  const ops = mock({ pods: [ok(pod)], pod_members: [ok(row), ok(null)] });
  await expect(removePodMember("actor", pod.id, row.member_id, row.created_at)).rejects.toThrow(
    "not confirmed",
  );
  expect(ops).toContainEqual(["pod_members", "eq", "created_at", row.created_at]);
});
it("does not delete a member re-added after the removal was reviewed", async () => {
  const ops = mock({
    pods: [ok(pod)],
    pod_members: [ok({ ...row, created_at: "2026-10-30T00:00:00Z" })],
  });
  await expect(removePodMember("actor", pod.id, row.member_id, row.created_at)).rejects.toThrow(
    "membership changed",
  );
  expect(ops.some((op) => op[1] === "delete")).toBe(false);
});
it("reconciles a lost removal acknowledgement without deleting again", async () => {
  const ops = mock({ pods: [ok(pod)], pod_members: [ok(null)] });
  await removePodMember("actor", pod.id, row.member_id, row.created_at);
  expect(ops.some((op) => op[1] === "delete")).toBe(false);
});
it("loads Pod and membership metadata across lower server page caps", async () => {
  const other = { ...pod, id: "second" };
  mock({
    pods: [ok([pod]), ok([other]), ok([])],
    pod_members: [ok([row]), ok([{ ...row, pod_id: other.id }]), ok([])],
    profiles: [ok([{ id: "old", display_name: "Leader", email: null }]), ok([])],
  });
  const result = await loadPods(new AbortController().signal);
  expect(result.pods).toHaveLength(2);
  expect(result.memberships).toHaveLength(2);
  expect(result.leaders).toHaveLength(1);
});
it("fails visibly when people or roles cannot be loaded completely", async () => {
  mock({
    profiles: [{ data: null, error: { message: "Profiles unavailable" } }],
    user_roles: [ok([])],
  });
  await expect(loadPodPeople(new AbortController().signal)).rejects.toThrow("Profiles unavailable");
});
