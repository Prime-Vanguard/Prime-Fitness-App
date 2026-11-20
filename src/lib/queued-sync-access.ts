import { supabase } from "@/integrations/supabase/client";
import { deviceScope } from "./device-scope";
import {
  isAuthenticationRequiredError,
  isTransientConnectionError,
  notifyRejectedOfflineSession,
  withConnectionTimeout,
} from "./offline-access";
import { clearQueuedSyncDelay, delayQueuedSync, queuedSyncRetryAt } from "./queued-sync-retry";

export { clearQueuedSyncDelay, delayQueuedSync } from "./queued-sync-retry";

type SyncQueue = "workout" | "records" | "cardio" | "preferences";
const accessChecks = new Map<string, Promise<boolean>>();

export class SyncRequestError extends Error {
  constructor(
    error: { message: string },
    readonly status: number,
  ) {
    super(error.message, { cause: error });
  }
}

export function isRetryableSyncFailure(error: unknown, status?: number) {
  const responseStatus = error instanceof SyncRequestError ? error.status : status;
  return (
    responseStatus === 0 ||
    responseStatus === 408 ||
    responseStatus === 429 ||
    (responseStatus !== undefined && responseStatus >= 500 && responseStatus <= 599) ||
    isTransientConnectionError(error instanceof SyncRequestError ? error.cause : error)
  );
}

/** Coalesce concurrent checks, but require fresh server evidence on a later retry. */
export function authorizeQueuedSync(memberId: string, queue: SyncQueue): Promise<boolean> {
  if (!navigator.onLine) return Promise.resolve(false);
  const scope = deviceScope(memberId);
  if (
    Date.now() < Math.max(queuedSyncRetryAt(memberId, queue), queuedSyncRetryAt(memberId, "access"))
  )
    return Promise.resolve(false);
  const running = accessChecks.get(scope);
  if (running) return running;
  const verify = async () => {
    // Another tab can set a delay while this tab is waiting for the lock.
    if (!navigator.onLine || Date.now() < queuedSyncRetryAt(memberId, "access")) return false;
    const authorized = await verifyActiveMember(memberId);
    if (authorized) clearQueuedSyncDelay(memberId, "access");
    else delayQueuedSync(memberId, "access");
    return authorized;
  };
  const check = Promise.resolve(
    navigator.locks ? navigator.locks.request(`pf-sync-access:${scope}`, verify) : verify(),
  ).finally(() => accessChecks.delete(scope));
  accessChecks.set(scope, check);
  return check;
}

async function verifyActiveMember(memberId: string) {
  try {
    const { data: identity, error } = await withConnectionTimeout(supabase.auth.getUser());
    if (isAuthenticationRequiredError(error)) notifyRejectedOfflineSession(memberId);
    if (error || identity.user?.id !== memberId) return false;
    const profile = await withConnectionTimeout(
      supabase.from("profiles").select("id,access_active").eq("id", memberId).maybeSingle(),
    );
    return !profile.error && profile.data?.id === memberId && profile.data.access_active;
  } catch {
    // A connection failure or unconfirmed account must leave every queue intact.
    return false;
  }
}

/** Bind each write to this account even if the SDK switches sessions before sending it. */
export async function queuedSyncAuthorization(memberId: string): Promise<string | null> {
  if (!navigator.onLine) return null;
  try {
    const { data, error } = await withConnectionTimeout(supabase.auth.getSession());
    if (isAuthenticationRequiredError(error)) notifyRejectedOfflineSession(memberId);
    const session = data.session;
    return !error && session?.user.id === memberId && session.access_token
      ? `Bearer ${session.access_token}`
      : null;
  } catch {
    delayQueuedSync(memberId, "access");
    return null;
  }
}
