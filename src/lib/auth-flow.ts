import type { AuthMessage } from "./auth-copy";
import { appPath, stripAppBase } from "./app-path";
const unsafe = (text: string) =>
  Array.from(text).some((c) => c === "\\" || c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);

/** Only application paths. Never accept protocol-relative/escaped redirects. */
export function safeAuthRedirect(input: unknown): string {
  if (typeof input !== "string" || !input.startsWith("/") || unsafe(input)) return "/today";
  try {
    const path = stripAppBase(input);
    const decoded = decodeURIComponent(path);
    if (decoded.startsWith("//") || unsafe(decoded)) return "/today";
    const url = new URL(path, "https://prime.invalid");
    if (
      url.origin !== "https://prime.invalid" ||
      /^\/(auth|reset-password)(\/|$)/i.test(decodeURIComponent(url.pathname))
    )
      return "/today";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/today";
  }
}
export function authErrorMessage(error: unknown): AuthMessage {
  const e = error as { code?: string; status?: number; message?: string };
  if (e?.code === "invalid_credentials") return "credentials";
  if (e?.code === "email_not_confirmed") return "unconfirmed";
  if (e?.code === "weak_password") return "weak";
  if (e?.code === "same_password") return "same";
  if (
    [
      "otp_expired",
      "flow_state_expired",
      "flow_state_not_found",
      "session_not_found",
      "refresh_token_not_found",
    ].includes(e?.code ?? "")
  )
    return "invalidLink";
  if (e?.status === 429 || e?.code?.startsWith("over_")) return "rate";
  // Only an explicit invitation failure can be described as one. Supabase may
  // intentionally hide trigger details behind unexpected_failure; keep it generic.
  if (/no valid invitation|invite.only.*invitation/i.test(e?.message ?? "")) return "invitation";
  if (
    error instanceof TypeError ||
    e?.status === 0 ||
    /fetch|network|connection/i.test(e?.message ?? "")
  )
    return "network";
  return "service";
}
export function hasAuthLinkError(url: URL) {
  const hash = new URLSearchParams(url.hash.slice(1));
  return ["error", "error_code"].some((key) => url.searchParams.has(key) || hash.has(key));
}
export const confirmationUrl = (origin: string, redirect: string) =>
  `${origin}${appPath("auth")}?redirect=${encodeURIComponent(safeAuthRedirect(redirect))}`;
export const RECOVERY_KEY = "pf-recovery-ui";
let memoryRecovery: string | null = null;
// UI continuity only. The Auth service remains the authority for password updates.
export function rememberRecovery(userId: string) {
  memoryRecovery = JSON.stringify({ userId, expires: Date.now() + 15 * 60000 });
  try {
    sessionStorage.setItem(RECOVERY_KEY, memoryRecovery);
  } catch {
    /* Private browsing fallback. */
  }
}
export function clearRecovery() {
  memoryRecovery = null;
  try {
    sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    /* Private browsing fallback. */
  }
}
export function recoveryExpiry(userId: string) {
  let raw = memoryRecovery;
  try {
    if (!recoveryRemembered(raw, userId)) raw = sessionStorage.getItem(RECOVERY_KEY);
  } catch {
    /* Private browsing fallback. */
  }
  return recoveryRemembered(raw, userId) ? Number(JSON.parse(raw!).expires) : 0;
}
export function recoveryRemembered(raw: string | null, userId: string, now = Date.now()) {
  try {
    const value = JSON.parse(raw ?? "null") as { userId?: string; expires?: number } | null;
    return (
      value?.userId === userId &&
      typeof value.expires === "number" &&
      value.expires > now &&
      value.expires <= now + 15 * 60000
    );
  } catch {
    return false;
  }
}
