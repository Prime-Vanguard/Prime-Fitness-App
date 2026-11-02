import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authErrorMessage,
  confirmationUrl,
  hasAuthLinkError,
  safeAuthRedirect,
  clearRecovery,
  rememberRecovery,
  recoveryExpiry,
  recoveryRemembered,
} from "./auth-flow";
afterEach(() => {
  clearRecovery();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("authentication destinations and feedback", () => {
  it.each([
    "//evil.example",
    "/\\evil.example",
    "/%2fevil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/auth",
    "/reset-password",
    "/x/../auth",
    "/%zz",
    "/today\n//evil.example",
  ])("rejects unsafe or looping destination %s", (path) => {
    expect(safeAuthRedirect(path)).toBe("/today");
  });
  it("preserves internal query parameters and fragments", () => {
    expect(safeAuthRedirect("/progress?exercise=bench#records")).toBe(
      "/progress?exercise=bench#records",
    );
    expect(
      new URL(
        confirmationUrl("https://prime.example", "/progress?exercise=bench"),
      ).searchParams.get("redirect"),
    ).toBe("/progress?exercise=bench");
    expect(safeAuthRedirect("/progress?search=bench%20press")).toBe(
      "/progress?search=bench%20press",
    );
  });
  it("does not label database outages as invitation failures", () => {
    expect(
      authErrorMessage({
        status: 500,
        code: "unexpected_failure",
        message: "Database error saving new user",
      }),
    ).toBe("service");
    expect(
      authErrorMessage({
        message: "Prime Fitness is invite-only. No valid invitation for this email.",
      }),
    ).toBe("invitation");
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe("credentials");
    expect(authErrorMessage({ code: "email_not_confirmed" })).toBe("unconfirmed");
    expect(authErrorMessage({ status: 429 })).toBe("rate");
    expect(authErrorMessage(new TypeError("Failed to fetch"))).toBe("network");
    expect(authErrorMessage({ code: "otp_expired" })).toBe("invalidLink");
  });
  it("recognizes expired callback errors without displaying their raw text", () => {
    expect(hasAuthLinkError(new URL("https://prime.example/auth#error_code=otp_expired"))).toBe(
      true,
    );
    expect(
      hasAuthLinkError(new URL("https://prime.example/reset-password?error=access_denied")),
    ).toBe(true);
  });
});
describe("recovery form continuity", () => {
  it("expires and binds its UI flag to the recovering member", () => {
    vi.useFakeTimers();
    rememberRecovery("member");
    expect(recoveryExpiry("member")).toBeGreaterThan(Date.now());
    expect(recoveryExpiry("other")).toBe(0);
    vi.advanceTimersByTime(15 * 60000 + 1);
    expect(recoveryExpiry("member")).toBe(0);
    expect(recoveryRemembered("{broken", "member")).toBe(false);
    expect(
      recoveryRemembered(
        JSON.stringify({ userId: "member", expires: Date.now() + 86400000 }),
        "member",
      ),
    ).toBe(false);
  });
  it("works when browser storage is unavailable and clears after use", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    rememberRecovery("member");
    expect(recoveryExpiry("member")).toBeGreaterThan(Date.now());
    clearRecovery();
    expect(recoveryExpiry("member")).toBe(0);
  });
});
