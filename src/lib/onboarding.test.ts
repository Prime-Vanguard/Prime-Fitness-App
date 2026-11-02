import { beforeEach, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), auth: { getUser: vi.fn() } },
}));
import { supabase } from "@/integrations/supabase/client";
import {
  onboardingInput,
  completeOnboarding,
  onboardingErrorText,
  type OnboardingDraft,
} from "./onboarding";
const draft: OnboardingDraft = {
  name: " Athlete ",
  locale: "en",
  units: "imperial",
  consent_at: "2026-10-31T12:00:00.000Z",
};
const before = {
  id: "member",
  display_name: "Old",
  locale: "en",
  units: "metric",
  consent_at: null,
  onboarding_completed: false,
  access_active: true,
};
const receipt = { ...before, ...onboardingInput(draft), consent_at: "2026-10-31T12:00:00+00:00" };
function mock(...results: { data: unknown; error: unknown }[]) {
  const ops: unknown[][] = [];
  vi.mocked(supabase.from).mockImplementation(() => {
    const result = results.shift();
    if (!result) throw new Error("Unexpected request");
    const query: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    for (const method of ["select", "eq", "update", "maybeSingle", "retry"])
      query[method] = (...args: unknown[]) => {
        ops.push([method, ...args]);
        return query;
      };
    return query as never;
  });
  return ops;
}
const ok = (data: unknown) => ({ data, error: null });
it("localizes actionable errors and keeps unknown backend details out of the form", () => {
  expect(
    onboardingErrorText(
      new Error("Active membership is required to finish setup. Contact your coach."),
      "ar",
    ),
  ).toContain("اشتراك نشط");
  expect(onboardingErrorText(new Error("private backend detail"), "en")).not.toContain(
    "private backend",
  );
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: "member" } },
    error: null,
  } as never);
});
it("trims names and rejects incomplete or invalid setup values", () => {
  expect(onboardingInput(draft).display_name).toBe("Athlete");
  for (const name of ["   ", "x".repeat(101)])
    expect(() => onboardingInput({ ...draft, name })).toThrow();
  expect(() => onboardingInput({ ...draft, units: "bad" } as never)).toThrow();
  expect(() => onboardingInput({ ...draft, consent_at: "invalid" })).toThrow();
});
it("refuses an account change before touching profile records", async () => {
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: "other" } },
    error: null,
  } as never);
  await expect(completeOnboarding("member", draft)).rejects.toThrow("same account");
  expect(supabase.from).not.toHaveBeenCalled();
});
it("requires an active, readable profile", async () => {
  for (const profile of [null, { ...before, access_active: false }]) {
    mock(ok(profile));
    await expect(completeOnboarding("member", draft)).rejects.toThrow("Active membership");
  }
});
it("does not treat a zero-row write as completed onboarding", async () => {
  mock(ok(before), ok(null));
  await expect(completeOnboarding("member", draft)).rejects.toThrow("not confirmed");
});
it("reconciles a saved response using the same consent instant without another write", async () => {
  const ops = mock(ok(receipt));
  expect(await completeOnboarding("member", draft)).toEqual(receipt);
  expect(ops.some(([op]) => op === "update")).toBe(false);
});
it("cannot overwrite a different completed setup", async () => {
  const ops = mock(ok({ ...receipt, display_name: "Changed on another device" }));
  await expect(completeOnboarding("member", draft)).rejects.toThrow("completed elsewhere");
  expect(ops.some(([op]) => op === "update")).toBe(false);
});
it("updates only an active incomplete profile and writes no membership or role fields", async () => {
  const ops = mock(ok(before), ok(receipt));
  await completeOnboarding("member", draft);
  expect(ops).toContainEqual(["eq", "onboarding_completed", false]);
  expect(ops).toContainEqual(["eq", "access_active", true]);
  expect(ops.find(([op]) => op === "update")![1]).toEqual(onboardingInput(draft));
});
it("rejects a mismatched receipt rather than showing success", async () => {
  mock(ok(before), ok({ ...receipt, id: "other" }));
  await expect(completeOnboarding("member", draft)).rejects.toThrow("not confirmed");
});
