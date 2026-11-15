import * as Sentry from "@sentry/tanstackstart-react";

import { scrubBreadcrumb, scrubEvent } from "./sentry-scrub";

let started = false;

function environment(): string {
  if (import.meta.env.MODE === "pages") return "pages-staging";
  return import.meta.env.PROD ? "production" : "development";
}

/**
 * Starts Sentry once per runtime (browser or Node SSR). Without a DSN this does nothing, so local
 * development, unit tests and builds without monitoring are unaffected.
 */
export function initSentry(): void {
  const dsn = import.meta.env["VITE_SENTRY_DSN"];
  if (started || !dsn) return;
  started = true;
  Sentry.init({
    dsn,
    environment: environment(),
    release: import.meta.env["VITE_SENTRY_RELEASE"] || undefined,
    // Health data and photos: collect no user info, cookies, headers, bodies, query strings or
    // local variables. The scrubber in sentry-scrub.ts is the second line of defence.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    },
    maxBreadcrumbs: 30,
    // Trace/span payloads have their own transport and bypass beforeSend.
    // Keep them disabled until an independently tested span allowlist exists.
    tracesSampleRate: 0,
    tracesSampler: () => 0,
    beforeSendTransaction: () => null,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

/** Reports an error with a short code and counts only; never pass record contents or file names. */
export function reportError(
  error: unknown,
  context?: { area: string; code?: string; count?: number },
): void {
  if (!started) return;
  Sentry.withScope((scope) => {
    if (context) {
      scope.setTag("area", context.area);
      if (context.code) scope.setTag("code", context.code);
      if (context.count !== undefined) scope.setExtra("count", context.count);
    }
    Sentry.captureException(error);
  });
}

export function setSentryMember(id: string | null): void {
  if (started) Sentry.setUser(id ? { id } : null);
}

export function flushSentry(timeoutMs = 2000): Promise<boolean> {
  return started ? Sentry.flush(timeoutMs) : Promise.resolve(true);
}

export { Sentry };
