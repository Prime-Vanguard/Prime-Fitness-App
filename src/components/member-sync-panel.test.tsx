import { it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ locale: "en" }) }));
vi.mock("@/lib/member-store", () => ({
  changeMemberState: vi.fn(),
  resolveMemberConflict: vi.fn(),
  syncMemberEntries: vi.fn(),
}));
import { changeMemberState, resolveMemberConflict } from "@/lib/member-store";
import { MemberSyncPanel } from "./member-sync-panel";
import type { MemberState } from "@/lib/member-store";
let root: Root | undefined;
const state: MemberState = {
  version: 1,
  records: {},
  queue: [
    {
      id: "m",
      record_id: "r",
      entity: "water_logs",
      op: "put",
      payload: { id: "r", ml: 250 },
      base_revision: 1,
      group: "g",
      status: "conflict",
      server: { id: "r", ml: 500 },
      server_revision: 2,
    },
  ],
  references: {},
  lastSync: null,
};
async function mount(next: MemberState = structuredClone(state), error = "") {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<MemberSyncPanel userId="member" state={next} error={error} />);
  });
}
async function click(name: string) {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent === name);
  expect(button).toBeDefined();
  await act(async () => {
    button!.click();
  });
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = "";
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
it("shows labeled differences and requires a reviewed choice with the displayed snapshot", async () => {
  vi.mocked(resolveMemberConflict).mockResolvedValue(undefined);
  await mount();
  expect(document.body.textContent).toContain("Water (ml)");
  expect(document.body.textContent).toContain("250");
  expect(document.body.textContent).toContain("500");
  expect(document.querySelector("pre")!.closest("details")!.open).toBe(false);
  await click("Keep server");
  expect(resolveMemberConflict).not.toHaveBeenCalled();
  await click("Confirm changes");
  expect(resolveMemberConflict).toHaveBeenCalledWith("member", "m", "server", state.queue);
});
it("distinguishes an unavailable server snapshot from a deleted record", async () => {
  const next = structuredClone(state);
  delete next.queue[0]!.server;
  delete next.queue[0]!.server_revision;
  await mount(next);
  expect(document.body.textContent).toContain("Server snapshot unavailable");
  expect(document.body.textContent).not.toContain("No server record");
  expect(
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Keep server")!.disabled,
  ).toBe(true);
});
it("does not export an unreadable cache or show unknown queue counts as zero", async () => {
  await mount({ ...structuredClone(state), queue: [] }, "Storage unavailable");
  expect(document.querySelector('[role="status"]')!.textContent).toContain("— entries");
  expect(
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Export pending data")!
      .disabled,
  ).toBe(true);
});
it("keeps pending records when device removal encounters an unconfirmed reward request", async () => {
  const latest = {
    ...structuredClone(state),
    references: { "redemption-intents": [{ id: "pending" }] },
  };
  vi.mocked(changeMemberState).mockImplementation(async (_user, fn) => fn(latest));
  await mount();
  const details = [...document.querySelectorAll("details")].find(
    (d) => d.querySelector("summary")?.textContent === "Remove device data",
  )!;
  await act(async () => {
    details.open = true;
  });
  await click("Remove device data");
  expect(changeMemberState).not.toHaveBeenCalled();
  await click("Confirm changes");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "Resolve unconfirmed reward requests",
  );
  expect(latest.queue).toHaveLength(1);
});
