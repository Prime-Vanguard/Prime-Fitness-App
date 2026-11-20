import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js";
import {
  withConnectionTimeout,
  forgetOfflineIdentity,
  readOfflineIdentity,
  saveOfflineIdentity,
  isTransientConnectionError,
  isAuthenticationRequiredError,
  reauthenticationMemberId,
  clearReauthentication,
  requireOfflineReauthentication,
} from "./offline-access";

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("VITE_SUPABASE_URL", "https://fitness-test.supabase.co");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const session = (id: string) =>
  localStorage.setItem(
    "sb-fitness-test-auth-token",
    JSON.stringify({ user: { id }, expires_at: 1 }),
  );

it("restores the prepared account even after token expiry without refreshing it", () => {
  session("A");
  saveOfflineIdentity({ id: "A" });
  expect(readOfflineIdentity()?.id).toBe("A");
  expect(
    localStorage.getItem("pf-offline-identity:https://fitness-test.supabase.co"),
  ).not.toContain("token");
});
it("does not restore another account or an explicitly signed-out identity", () => {
  session("A");
  saveOfflineIdentity({ id: "A" });
  session("B");
  expect(readOfflineIdentity()).toBeNull();
  session("A");
  forgetOfflineIdentity();
  expect(readOfflineIdentity()).toBeNull();
});
it("rejects missing, corrupt and other-project session storage", () => {
  saveOfflineIdentity({ id: "A" });
  expect(readOfflineIdentity()).toBeNull();
  localStorage.setItem("sb-fitness-test-auth-token", "broken");
  expect(readOfflineIdentity()).toBeNull();
  session("A");
  vi.stubEnv("VITE_SUPABASE_URL", "https://another.supabase.co");
  expect(readOfflineIdentity()).toBeNull();
});
it("retains a sign-in reminder after session removal without granting offline access", () => {
  session("A");
  saveOfflineIdentity({ id: "A", email: "private@example.test" });
  localStorage.removeItem("sb-fitness-test-auth-token");
  expect(requireOfflineReauthentication()).toBe(true);
  expect(reauthenticationMemberId()).toBe("A");
  session("A");
  expect(readOfflineIdentity()).toBeNull();
  clearReauthentication();
  saveOfflineIdentity({ id: "A" });
  expect(readOfflineIdentity()?.id).toBe("A");
});

it("ignores stale sign-out notifications for a different signed-in account", () => {
  session("A");
  saveOfflineIdentity({ id: "A" });
  session("B");
  expect(requireOfflineReauthentication("A")).toBe(false);
  saveOfflineIdentity({ id: "B" });
  expect(requireOfflineReauthentication("A")).toBe(false);
  expect(reauthenticationMemberId()).toBeNull();
  expect(readOfflineIdentity()?.id).toBe("B");
});
it("distinguishes unavailable connectivity from rejected authorization", () => {
  expect(isTransientConnectionError({ name: "AuthRetryableFetchError" })).toBe(true);
  expect(isTransientConnectionError({ status: 503 })).toBe(true);
  expect(isTransientConnectionError({ status: 401 })).toBe(false);
  expect(isTransientConnectionError({ status: 403 })).toBe(false);
  expect(isTransientConnectionError(new TypeError("Cannot read properties of undefined"))).toBe(
    false,
  );
  expect(isTransientConnectionError(new TypeError("Failed to fetch"))).toBe(true);
  expect(isTransientConnectionError({ code: "", message: "TypeError: Failed to fetch" })).toBe(
    true,
  );
  expect(isTransientConnectionError({ name: "AbortError" })).toBe(false);
});
it("redirects only recognized authentication failures rather than programming errors", () => {
  expect(isAuthenticationRequiredError(new AuthSessionMissingError())).toBe(true);
  expect(isAuthenticationRequiredError(new AuthApiError("Unauthorized", 401, undefined))).toBe(
    true,
  );
  expect(
    isAuthenticationRequiredError(
      new AuthApiError("Expired refresh", 400, "refresh_token_not_found"),
    ),
  ).toBe(true);
  expect(isAuthenticationRequiredError(new TypeError("Cannot read properties of undefined"))).toBe(
    false,
  );
  expect(isAuthenticationRequiredError(new Error("Unexpected failure"))).toBe(false);
});
it("reports identity storage failures instead of advertising offline preparation", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Quota exceeded", "QuotaExceededError");
  });
  expect(saveOfflineIdentity({ id: "A" })).toBe(false);
});
it("rejects malformed email fields and unsupported identity versions", () => {
  session("A");
  const storageKey = "pf-offline-identity:https://fitness-test.supabase.co";
  localStorage.setItem(storageKey, JSON.stringify({ version: 2, user: { id: "A" } }));
  expect(readOfflineIdentity()).toBeNull();
  localStorage.setItem(storageKey, JSON.stringify({ version: 1, user: { id: "A", email: {} } }));
  expect(readOfflineIdentity()).toBeNull();
});
it("bounds a stalled auth request and still observes its late rejection", async () => {
  let reject!: (e: Error) => void;
  const stalled = new Promise((_, fail) => {
    reject = fail;
  });
  await expect(withConnectionTimeout(stalled, 5)).rejects.toMatchObject({ name: "TimeoutError" });
  reject(new Error("late network failure"));
  await expect(withConnectionTimeout(Promise.resolve("ready"))).resolves.toBe("ready");
});
