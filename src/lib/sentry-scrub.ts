import type { Breadcrumb, ErrorEvent, EventHint } from "@sentry/tanstackstart-react";

// Members log health data and private photos, so nothing user-authored may reach Sentry. These
// helpers are pure so they can be unit tested; sentry.ts plugs them into the SDK hooks.

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const JWT = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const KEYS = /\bsb_(?:publishable|secret)_[A-Za-z0-9_-]{8,}/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;

/** Redacts credentials and member ids from free text such as error messages. */
export function scrubText(text: string): string {
  return text
    .replace(JWT, "[token]")
    .replace(KEYS, "[key]")
    .replace(BEARER, "Bearer [token]")
    .replace(UUID, "[id]");
}

/** Keeps only origin and path: query strings carry signed photo tokens, and paths can carry member ids. */
export function scrubUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url, "http://local.invalid");
  } catch {
    return scrubText(url.split(/[?#]/)[0] ?? "");
  }
  const origin = parsed.origin === "http://local.invalid" ? "" : parsed.origin;
  return scrubText(`${origin}${parsed.pathname}`);
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  // DOM selectors, filenames and even URL paths can contain health information.
  if (!["fetch", "xhr"].includes(crumb.category ?? "")) return null;
  const data: Record<string, unknown> = {};
  const method = crumb.data?.["method"];
  const status = crumb.data?.["status_code"];
  if (typeof method === "string" && /^(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)$/.test(method))
    data["method"] = method;
  if (typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599)
    data["status_code"] = status;
  return { category: crumb.category!, data };
}

const OFFLINE_NOISE = [
  /failed to fetch/i,
  /load failed/i,
  /networkerror/i,
  /network request failed/i,
];

/** Offline use is normal for this app, so connectivity failures are not bugs. */
function isOfflineNoise(event: ErrorEvent, hint?: EventHint): boolean {
  const original = hint?.originalException;
  if (original instanceof DOMException && original.name === "AbortError") return true;
  const first = event.exception?.values?.[0];
  const text = `${first?.type ?? ""}: ${first?.value ?? ""}`;
  if (/AbortError/.test(text)) return true;
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return offline && OFFLINE_NOISE.some((pattern) => pattern.test(text));
}

export function scrubEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent | null {
  if (isOfflineNoise(event, hint)) return null;
  // Rebuild rather than redact: SDK integrations can add unexpected payload fields.
  // Keep numeric stack locations only; filenames and source text are untrusted.
  const clean: ErrorEvent = {
    type: undefined,
    platform: "javascript",
    message: "Application error (details withheld)",
  };
  if (event.event_id && /^[a-f0-9]{32}$/i.test(event.event_id)) clean.event_id = event.event_id;
  if (typeof event.timestamp === "number" && Number.isFinite(event.timestamp))
    clean.timestamp = event.timestamp;
  if (typeof event.release === "string" && /^[a-f0-9]{40}$/i.test(event.release))
    clean.release = event.release;
  if (["production", "development", "pages-staging"].includes(event.environment ?? ""))
    clean.environment = event.environment!;
  const area = event.tags?.["area"];
  clean.tags = {};
  if (
    typeof area === "string" &&
    ["route", "request", "ssr", "server", "workout-sync"].includes(area)
  )
    clean.tags["area"] = area;
  if (event.tags?.["code"] === "retries-exhausted") clean.tags["code"] = "retries-exhausted";
  const count = event.extra?.["count"];
  if (typeof count === "number" && Number.isSafeInteger(count) && count >= 0)
    clean.extra = { count };
  clean.exception = {
    values: (event.exception?.values ?? []).map((value) => ({
      type: ["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError"].includes(
        value.type ?? "",
      )
        ? value.type!
        : "Error",
      value: "Details withheld",
      stacktrace: {
        frames: (value.stacktrace?.frames ?? []).map((frame) => ({
          filename: "[redacted]",
          ...(typeof frame.lineno === "number" ? { lineno: frame.lineno } : {}),
          ...(typeof frame.colno === "number" ? { colno: frame.colno } : {}),
        })),
      },
    })),
  };
  clean.breadcrumbs = (event.breadcrumbs ?? []).flatMap((crumb) => {
    const safe = scrubBreadcrumb(crumb);
    return safe ? [safe] : [];
  });
  return clean;
}
