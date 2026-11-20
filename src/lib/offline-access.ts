import { isAuthError, type User } from "@supabase/supabase-js";
import { z } from "zod";

export type OfflineIdentity = Pick<User, "id" | "email">;
const getProjectUrl = () => import.meta.env["VITE_SUPABASE_URL"];
const getIdentityStorageKey = () => `pf-offline-identity:${getProjectUrl()}`;
const getReauthenticationKey = () => `pf-reauthentication:${getProjectUrl()}`;
const reauthenticationEvent = "pf-reauthentication-required";
const offlineIdentitySchema = z.object({ id: z.string().min(1), email: z.string().optional() });
const identitySnapshotSchema = z.object({ version: z.literal(1), user: offlineIdentitySchema });

/** Local UI continuity only. Never use this snapshot to authorize server writes. */
export function saveOfflineIdentity(user: OfflineIdentity): boolean {
  try {
    if (!getProjectUrl()) return false;
    localStorage.setItem(
      getIdentityStorageKey(),
      JSON.stringify({ version: 1, user: { id: user.id, email: user.email } }),
    );
    return true;
  } catch {
    return false;
  }
}

export function forgetOfflineIdentity() {
  try {
    localStorage.removeItem(getIdentityStorageKey());
  } catch {
    /* Storage may be disabled by browser policy. */
  }
}

function readPreparedIdentity(): OfflineIdentity | null {
  try {
    const projectUrl = getProjectUrl();
    if (!projectUrl) return null;
    const storedIdentity: unknown = JSON.parse(
      localStorage.getItem(getIdentityStorageKey()) ?? "null",
    );
    const snapshot = identitySnapshotSchema.safeParse(storedIdentity);
    // Accept the initial unversioned format without accepting unknown future versions.
    const legacyIdentity = z
      .object({ version: z.never().optional() })
      .and(offlineIdentitySchema)
      .safeParse(storedIdentity);
    const user = snapshot.success
      ? snapshot.data.user
      : legacyIdentity.success
        ? legacyIdentity.data
        : null;
    if (!user) return null;
    return { id: user.id, ...(typeof user.email === "string" ? { email: user.email } : {}) };
  } catch {
    return null;
  }
}

function readStoredSessionMemberId(): string | null {
  try {
    const projectUrl = getProjectUrl();
    if (!projectUrl) return null;
    const sdkKey = `sb-${new URL(projectUrl).hostname.split(".")[0]}-auth-token`;
    const session = JSON.parse(localStorage.getItem(sdkKey) ?? "null");
    return typeof session?.user?.id === "string" ? session.user.id : null;
  } catch {
    return null;
  }
}

export function readOfflineIdentity(): OfflineIdentity | null {
  const prepared = readPreparedIdentity();
  // Read the SDK's stored ID without attempting to refresh an expired token.
  return prepared &&
    prepared.id === readStoredSessionMemberId() &&
    prepared.id !== reauthenticationMemberId()
    ? prepared
    : null;
}

export function reauthenticationMemberId(): string | null {
  try {
    return localStorage.getItem(getReauthenticationKey());
  } catch {
    return null;
  }
}

export function clearReauthentication() {
  try {
    localStorage.removeItem(getReauthenticationKey());
  } catch {
    /* Sign-in must still work when storage is unavailable. */
  }
}

/** Keep a sign-in hint for the previous member after the SDK drops its session. */
export function requireOfflineReauthentication(expectedMemberId?: string): boolean {
  const prepared = readPreparedIdentity();
  if (!prepared || (expectedMemberId && prepared.id !== expectedMemberId)) return false;
  const currentMemberId = readStoredSessionMemberId();
  // Ignore a late event after a different account is already signed in.
  if (currentMemberId && currentMemberId !== prepared.id) return false;
  try {
    localStorage.setItem(getReauthenticationKey(), prepared.id);
  } catch {
    /* The hint does not grant access or contain any saved work. */
  }
  forgetOfflineIdentity();
  return true;
}

export function notifyRejectedOfflineSession(memberId: string) {
  if (requireOfflineReauthentication(memberId))
    window.dispatchEvent(new Event(reauthenticationEvent));
}

export function watchOfflineReauthentication(onRequired: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === getReauthenticationKey() &&
      event.newValue &&
      event.newValue === reauthenticationMemberId()
    )
      onRequired();
  };
  window.addEventListener(reauthenticationEvent, onRequired);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(reauthenticationEvent, onRequired);
    window.removeEventListener("storage", onStorage);
  };
}

export function restoreOfflineIdentityAfterFailedSignOut(identity: OfflineIdentity | null) {
  if (identity && identity.id === readStoredSessionMemberId()) saveOfflineIdentity(identity);
}

export function isTransientConnectionError(error: unknown): boolean {
  const fetchFailurePattern =
    /^(?:TypeError: )?(?:Failed to fetch|fetch failed|NetworkError(?: when attempting to fetch resource\.?)?|Load failed)$/i;
  if (error instanceof TypeError) return fetchFailurePattern.test(error.message);
  if (!error || typeof error !== "object") return false;
  const connectionError = error as {
    name?: string;
    status?: number;
    code?: string;
    message?: string;
  };
  // PostgREST wraps fetch failures in a plain error object rather than TypeError.
  if (connectionError.code === "" && fetchFailurePattern.test(connectionError.message ?? ""))
    return true;
  return (
    connectionError.name === "AuthRetryableFetchError" ||
    connectionError.name === "TimeoutError" ||
    (typeof connectionError.status === "number" &&
      connectionError.status >= 500 &&
      connectionError.status <= 599)
  );
}

export function isAuthenticationRequiredError(error: unknown): boolean {
  return (
    isAuthError(error) &&
    (error.name === "AuthSessionMissingError" ||
      error.status === 401 ||
      error.status === 403 ||
      error.code === "refresh_token_not_found" ||
      error.code === "refresh_token_already_used" ||
      error.code === "session_not_found" ||
      error.code === "bad_jwt")
  );
}

/** Bound UI restoration without cancelling the SDK's coordinated token refresh. */
export async function withConnectionTimeout<T>(
  pendingRequest: PromiseLike<T>,
  timeoutMilliseconds = 5000,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(pendingRequest),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new DOMException("Connection timed out", "TimeoutError")),
          timeoutMilliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}
