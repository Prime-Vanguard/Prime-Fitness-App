import { it, expect } from "vitest";
import { conflictFields, entityLabel, mutationSummary } from "./recovery-presentation";
import { importReceipt } from "./import-receipt";
it("compares canonical values without mistaking zero for missing or exposing identity metadata", () => {
  const fields = conflictFields(
    { id: "private-id", member_id: "private-member", ml: 0, notes: "Device" },
    { id: "server-id", ml: 250, notes: "Server", revision: 9 },
    false,
  );
  expect(fields.map((f) => f.key)).toEqual(["ml", "notes"]);
  expect(fields[0]).toMatchObject({ local: 0, server: 250, changed: true });
  expect(
    conflictFields(
      { id: "x", items: [{ name: "Milk", calories: 100 }] },
      { id: "x", items: [{ calories: 100, name: "Milk" }] },
      false,
    )[0]!.changed,
  ).toBe(false);
  expect(conflictFields({ id: "x", sleep_hours: null }, { id: "x" }, false)[0]!.changed).toBe(
    false,
  );
});
it("labels wellness and canonical measurement units in Arabic", () => {
  expect(entityLabel("wellness_checkins", true)).toBe("الحالة اليومية");
  expect(conflictFields({ id: "x", weight_kg: 80 }, null, true)[0]!.label).toContain("كجم");
});
it("counts queue states without counting entries as synchronized", () => {
  expect(
    mutationSummary([
      { status: "queued" },
      { status: "sending" },
      { status: "conflict" },
      { status: "rejected" },
    ] as never),
  ).toEqual({ queued: 1, sending: 1, conflict: 1, rejected: 1 });
});
it("requires complete durable receipt counts rather than treating missing values as zero", () => {
  expect(importReceipt({ accepted: 100, skipped: 2, chunks: 2 })).toEqual({
    accepted: 100,
    skipped: 2,
    chunks: 2,
  });
  for (const value of [
    null,
    {},
    { accepted: 1, skipped: 0 },
    { accepted: -1, skipped: 0, chunks: 1 },
    { accepted: 1, skipped: 0, chunks: 1.2 },
  ])
    expect(() => importReceipt(value)).toThrow();
});
