import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("./admin-member-write", () => ({ requireActiveAdmin: vi.fn() }));
import { supabase } from "@/integrations/supabase/client";
import { requireActiveAdmin } from "./admin-member-write";
import {
  createInvitation,
  invitationInput,
  inviteSearch,
  inviteStatus,
  loadInvitations,
  revokeInvitation,
  type Invitation,
} from "./admin-invites";
import {
  createPvTask,
  decidePvClaim,
  decisionInput,
  loadClaimQueue,
  pvSearch,
  setPvTaskActive,
  taskInput,
  type ClaimContext,
  type PvTask,
} from "./admin-pv";
const actor = "admin";
const invite: Invitation = {
  id: "invite",
  email: "member@test.invalid",
  role: "member",
  invited_by: actor,
  accepted_at: null,
  revoked_at: null,
  expires_at: "2030-11-13T10:00:00Z",
  created_at: "2030-10-30T10:00:00Z",
  pod_id: null,
  coach_id: null,
};
const task: PvTask = {
  id: "task",
  title_en: "Weekly task",
  title_ar: null,
  points: 50,
  active: true,
  created_by: actor,
  created_at: invite.created_at,
  description: null,
};
const claim: ClaimContext = {
  id: "claim",
  member_id: "member",
  task_id: task.id,
  note: "Evidence",
  status: "pending",
  review_note: null,
  reviewed_at: null,
  reviewed_by: null,
  created_at: invite.created_at,
  pv_tasks: task,
};
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
      "update",
      "range",
      "order",
      "abortSignal",
      "in",
      "retry",
      "maybeSingle",
      "single",
      "gt",
      "limit",
      "ilike",
    ])
      query[method] = (...args: unknown[]) => {
        ops.push([table, method, ...args]);
        return query;
      };
    return query as never;
  });
  return ops;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireActiveAdmin).mockResolvedValue(false);
});
it("normalizes invite emails and rejects invalid input", () => {
  expect(invitationInput(" MEMBER@Test.Invalid ", "member").email).toBe(invite.email);
  expect(() => invitationInput("not an email", "member")).toThrow("valid email");
});
it("classifies invite status at expiry and keeps accepted/revoked precedence", () => {
  const now = Date.parse(invite.expires_at);
  expect(inviteStatus(invite, now - 1)).toBe("pending");
  expect(inviteStatus(invite, now)).toBe("expired");
  expect(
    inviteStatus({ ...invite, accepted_at: invite.created_at, revoked_at: invite.created_at }, now),
  ).toBe("accepted");
  expect(inviteStatus({ ...invite, revoked_at: invite.created_at }, now)).toBe("revoked");
  expect(inviteStatus({ ...invite, expires_at: "invalid" }, now)).toBe("unknown");
});
it("bounds invitation/PV filters and drops unknown sections and IDs", () => {
  expect(inviteSearch({ page: -2, status: "admin", q: "a".repeat(300) })).toEqual({
    page: undefined,
    status: undefined,
    q: "a".repeat(150),
  });
  expect(pvSearch({ section: "anything", status: "approved", claim: "bad" })).toMatchObject({
    section: undefined,
    status: undefined,
    claim: undefined,
  });
});
it("rechecks administrator access before any invitation mutation", async () => {
  vi.mocked(requireActiveAdmin).mockRejectedValue(new Error("Access withdrawn"));
  await expect(createInvitation(actor, invite)).rejects.toThrow("Access withdrawn");
  expect(supabase.from).not.toHaveBeenCalled();
});
it("requires a current super administrator for privileged invitation creation and revocation", async () => {
  await expect(createInvitation(actor, { ...invite, role: "admin" })).rejects.toThrow(
    "super administrator",
  );
  await expect(revokeInvitation(actor, { ...invite, role: "super_admin" })).rejects.toThrow(
    "super administrator",
  );
  expect(supabase.from).not.toHaveBeenCalled();
});
it("reconciles a saved invitation without inserting or dispatching again", async () => {
  const ops = mock({ invites: [ok(invite)] }),
    dispatched = vi.fn();
  await expect(createInvitation(actor, invite, dispatched)).resolves.toEqual(invite);
  expect(dispatched).not.toHaveBeenCalled();
  expect(ops.some((o) => o[1] === "insert")).toBe(false);
});
it("does not reuse another actor's invitation receipt", async () => {
  mock({ invites: [ok({ ...invite, invited_by: "other" })] });
  await expect(createInvitation(actor, invite)).rejects.toThrow("different invitation");
});
it("checks exact pending emails before a new request and escapes LIKE metacharacters", async () => {
  const ops = mock({ invites: [ok(null), ok({ id: "other" })] });
  await expect(
    createInvitation(actor, { ...invite, email: "pv_member@test.invalid" }),
  ).rejects.toThrow("pending invitation");
  expect(ops).toContainEqual(["invites", "ilike", "email", "pv\\_member@test.invalid"]);
  expect(ops.some((o) => o[1] === "insert")).toBe(false);
});
it("requires a returned creation receipt and reuses its stable ID", async () => {
  const ops = mock({ invites: [ok(null), ok(null), ok(null)] });
  await expect(createInvitation(actor, invite)).rejects.toThrow("not confirmed");
  expect(ops).toContainEqual([
    "invites",
    "insert",
    { id: invite.id, email: invite.email, role: invite.role, invited_by: actor },
  ]);
});
it("rejects revocation after acceptance without writing", async () => {
  const ops = mock({ invites: [ok({ ...invite, accepted_at: invite.created_at })] });
  await expect(revokeInvitation(actor, invite)).rejects.toThrow("was accepted");
  expect(ops.some((o) => o[1] === "update")).toBe(false);
});
it("reconciles an already revoked invitation without another update", async () => {
  const ops = mock({ invites: [ok({ ...invite, revoked_at: invite.created_at })] });
  await revokeInvitation(actor, invite);
  expect(ops.some((o) => o[1] === "update")).toBe(false);
});
it("conditions revocation on immutable fields and pending acceptance", async () => {
  const ops = mock({ invites: [ok(invite), ok(null)] });
  await expect(revokeInvitation(actor, invite)).rejects.toThrow("not confirmed");
  expect(ops).toContainEqual(["invites", "is", "accepted_at", null]);
  expect(ops).toContainEqual(["invites", "eq", "expires_at", invite.expires_at]);
});
it("loads complete invitations across lower server caps", async () => {
  mock({ invites: [ok([invite]), ok([{ ...invite, id: "second" }]), ok([])] });
  await expect(loadInvitations(new AbortController().signal)).resolves.toHaveLength(2);
});
it("requires whole positive task points and supports Arabic numerals", () => {
  expect(taskInput({ title_en: " Task ", title_ar: "", points: "٥٠" })).toEqual({
    title_en: "Task",
    title_ar: null,
    points: 50,
  });
  for (const points of ["50x", "0", "2.5", "2147483648"])
    expect(() => taskInput({ title_en: "Task", title_ar: "", points })).toThrow();
});
it("reconciles task creation without overwriting a saved task", async () => {
  const ops = mock({ pv_tasks: [ok(task)] });
  await expect(createPvTask(actor, task)).resolves.toEqual(task);
  expect(ops.some((o) => o[1] === "insert")).toBe(false);
  mock({ pv_tasks: [ok({ ...task, points: 60 })] });
  await expect(createPvTask(actor, task)).rejects.toThrow("different task");
});
it("requires a task visibility receipt and rejects changed task content", async () => {
  let ops = mock({ pv_tasks: [ok({ ...task, points: 99 })] });
  await expect(setPvTaskActive(actor, task, false)).rejects.toThrow("details changed");
  expect(ops.some((o) => o[1] === "update")).toBe(false);
  ops = mock({ pv_tasks: [ok(task), ok(null)] });
  await expect(setPvTaskActive(actor, task, false)).rejects.toThrow("not confirmed");
  expect(ops).toContainEqual(["pv_tasks", "eq", "active", true]);
});
it("requires meaningful feedback for rejection and information requests", () => {
  expect(() => decisionInput("needs_info", " ")).toThrow("Give a reason");
  expect(() => decisionInput("rejected", "")).toThrow("Give a reason");
  expect(decisionInput("approved", " ")).toEqual({ status: "approved", review_note: null });
  expect(() => decisionInput("approved", "x".repeat(2001))).toThrow("2,000");
});
it("rejects self-review and withdrawn administrator access before claim writes", async () => {
  await expect(
    decidePvClaim(actor, { ...claim, member_id: actor }, "approved", ""),
  ).rejects.toThrow("own claim");
  expect(supabase.from).not.toHaveBeenCalled();
  vi.mocked(requireActiveAdmin).mockRejectedValue(new Error("Access withdrawn"));
  await expect(decidePvClaim(actor, claim, "approved", "")).rejects.toThrow("Access withdrawn");
});
it("rejects a competing final decision and a stale needs-info review", async () => {
  let ops = mock({
    pv_claims: [
      ok({ ...claim, status: "approved", reviewed_by: "other", reviewed_at: invite.created_at }),
    ],
  });
  await expect(decidePvClaim(actor, claim, "approved", "")).rejects.toThrow("already decided");
  expect(ops.some((o) => o[1] === "update")).toBe(false);
  ops = mock({ pv_claims: [ok({ ...claim, status: "needs_info", review_note: "New feedback" })] });
  await expect(decidePvClaim(actor, claim, "rejected", "Reason")).rejects.toThrow("another tab");
  expect(ops.some((o) => o[1] === "update")).toBe(false);
});
it("requires the reviewed task award to match the current preflight", async () => {
  const ops = mock({ pv_claims: [ok({ ...claim, pv_tasks: { ...task, points: 100 } })] });
  await expect(decidePvClaim(actor, claim, "approved", "")).rejects.toThrow("points changed");
  expect(ops.some((o) => o[1] === "update")).toBe(false);
});
it("conditions decisions on the complete reviewed claim and rejects zero-row success", async () => {
  const ops = mock({ pv_claims: [ok(claim), ok(null)] });
  await expect(decidePvClaim(actor, claim, "approved", "")).rejects.toThrow("not confirmed");
  expect(ops).toContainEqual(["pv_claims", "eq", "id", claim.id]);
  expect(ops).toContainEqual(["pv_claims", "is", "reviewed_at", null]);
  expect(ops).toContainEqual(["pv_claims", "eq", "note", claim.note]);
});
it("reconciles an approval acknowledgement from the existing server ledger without updating again", async () => {
  const accepted = {
    ...claim,
    status: "approved",
    reviewed_by: actor,
    reviewed_at: invite.created_at,
  };
  const ops = mock({
    pv_claims: [ok(accepted)],
    pv_ledger: [ok({ claim_id: claim.id, member_id: claim.member_id, points: 50 })],
  });
  await expect(decidePvClaim(actor, claim, "approved", "")).resolves.toMatchObject({ awarded: 50 });
  expect(ops.some((o) => o[1] === "update" || o[1] === "insert")).toBe(false);
});
it("does not claim an award without a matching server receipt", async () => {
  mock({
    pv_claims: [
      ok({ ...claim, status: "approved", reviewed_by: actor, reviewed_at: invite.created_at }),
    ],
    pv_ledger: [ok(null)],
  });
  await expect(decidePvClaim(actor, claim, "approved", "")).rejects.toThrow(
    "receipt could not be confirmed",
  );
});
it("reports the actual server award even if a concurrent task edit changed it after preflight", async () => {
  mock({
    pv_claims: [
      ok(claim),
      ok({ ...claim, status: "approved", reviewed_by: actor, reviewed_at: invite.created_at }),
    ],
    pv_ledger: [ok({ claim_id: claim.id, member_id: claim.member_id, points: 60 })],
  });
  await expect(decidePvClaim(actor, claim, "approved", "")).resolves.toMatchObject({ awarded: 60 });
});
it("never reads or writes the reward ledger for a non-awarding decision", async () => {
  const ops = mock({
    pv_claims: [
      ok(claim),
      ok({
        ...claim,
        status: "needs_info",
        review_note: "More proof",
        reviewed_by: actor,
        reviewed_at: invite.created_at,
      }),
    ],
  });
  await expect(decidePvClaim(actor, claim, "needs_info", "More proof")).resolves.toMatchObject({
    awarded: null,
  });
  expect(ops.some((o) => o[0] === "pv_ledger")).toBe(false);
});
it("loads reviewed queues completely and scopes profile metadata to claim members", async () => {
  const ops = mock({
    pv_claims: [ok([claim]), ok([{ ...claim, id: "second" }]), ok([])],
    profiles: [ok([{ id: claim.member_id, display_name: "Member", email: null }]), ok([])],
  });
  const result = await loadClaimQueue("reviewed", new AbortController().signal);
  expect(result.claims).toHaveLength(2);
  expect(ops).toContainEqual(["pv_claims", "in", "status", ["approved", "rejected"]]);
  expect(ops).toContainEqual(["profiles", "in", "id", [claim.member_id]]);
});
