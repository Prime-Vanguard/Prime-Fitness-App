import { deviceScope } from "./device-scope";

const queues = ["workout", "records", "cardio", "preferences", "access"] as const;
type RetryScope = (typeof queues)[number];
type RetryDelay = { failures: number; retryAt: number };
const RETRY_BASE_MS = 15000;
const MAX_FAILURES = 4;
const MAX_DELAY_MS = RETRY_BASE_MS * 2 ** (MAX_FAILURES - 1);
const FAILURE_HISTORY_MS = 10 * 60000;
const storageKey = (memberId: string, queue: RetryScope) =>
  `pf-sync-retry:${deviceScope(memberId)}:${queue}`;
const fallback = new Map<string, RetryDelay | undefined>();

function readDelay(key: string): RetryDelay | undefined {
  if (fallback.has(key)) return fallback.get(key);
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null") as Partial<RetryDelay> | null;
    const now = Date.now();
    if (
      typeof value?.failures === "number" &&
      Number.isInteger(value.failures) &&
      value.failures >= 1 &&
      value.failures <= MAX_FAILURES &&
      typeof value.retryAt === "number" &&
      Number.isSafeInteger(value.retryAt) &&
      value.retryAt <= now + MAX_DELAY_MS &&
      value.retryAt > now - FAILURE_HISTORY_MS
    ) {
      return { failures: value.failures, retryAt: value.retryAt };
    }
  } catch {
    // A malformed or inaccessible record cannot stop synchronization.
  }
  return undefined;
}

function writeDelay(key: string, value?: RetryDelay) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
    fallback.delete(key);
  } catch {
    fallback.set(key, value);
  }
}

export function queuedSyncRetryAt(memberId: string, queue: RetryScope) {
  return readDelay(storageKey(memberId, queue))?.retryAt ?? 0;
}

export function delayQueuedSync(memberId: string, queue: RetryScope) {
  const key = storageKey(memberId, queue);
  const failures = Math.min(MAX_FAILURES, (readDelay(key)?.failures ?? 0) + 1);
  writeDelay(key, { failures, retryAt: Date.now() + RETRY_BASE_MS * 2 ** (failures - 1) });
}

export function clearQueuedSyncDelay(memberId: string, queue?: RetryScope) {
  for (const target of queue ? [queue] : queues) writeDelay(storageKey(memberId, target));
}
