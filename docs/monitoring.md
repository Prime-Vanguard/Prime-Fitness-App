# Error monitoring (Sentry)

## Privacy hardening — 15 November 2026

The implementation now rebuilds events from an allowlist and drops user/request
details, arbitrary error text, filenames and extensible context. Only fixed
diagnostic codes/counts, numeric stack locations and safe transport status remain.
Tracing and router tracing integration are disabled until a separately tested
span privacy contract exists. Source-map resolution is consequently limited.
This supersedes the earlier scrubber/tracing description below; see the
[security checkpoint](readiness/security-remediation-2026-11-15.md) for evidence.

Errors go to the `prime-fitness-app` project in the `prime-vanguard` Sentry organisation, on the EU region (`de.sentry.io`). The free plan has no Session Replay, and the app does not use it: replays would record body photos, meals and measurements.

## How it works

- `src/lib/sentry.ts` starts Sentry once in the browser and in Node SSR. With no `VITE_SENTRY_DSN` it does nothing, so development, unit tests and local builds are unaffected.
- Browser errors are captured by the SDK's global handlers and by the router's `defaultOnCatch` (route error boundaries). Server errors are captured in `src/start.ts` and `src/server.ts`.
- `WorkoutSync` reports once per failure streak (four failed 15-second retries), never per attempt.
- Use `reportError(error, { area, code, count })` for deliberate reports. Pass codes and counts only, never record contents, names or file names.

## Privacy

- `dataCollection` is set to collect no user info, cookies, headers, request bodies, query strings, database query data or local variables.
- `src/lib/sentry-scrub.ts` is the second line of defence (`beforeSend` and `beforeBreadcrumb`). It removes tokens, keys and member ids from text, keeps only origin and path of URLs, drops console breadcrumbs, keeps only the opaque member id as the user, and drops offline and aborted-request noise. It is covered by `src/lib/sentry-scrub.test.ts`.
- The privacy page must name Sentry (EU region) as a processor. The founder approves that wording.

## Configuration

| Name                  | Where                                                   | Notes                                               |
| --------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| `VITE_SENTRY_DSN`     | build environment; `config/pages-public.json` for Pages | Public. Must be an EU ingest address.               |
| `VITE_SENTRY_RELEASE` | CI (`github.sha`)                                       | Groups errors by commit.                            |
| `SENTRY_AUTH_TOKEN`   | CI secret only, never `VITE_`                           | Uploads source maps; without it, no upload happens. |

The Vite plugin uploads hidden source maps and deletes them afterwards. `scripts/check-pages-output.mjs` fails the Pages build if a `.map` file, an auth token or a Sentry token marker is in `dist/client`.

## Alerts

The project's default rule emails about high-priority new issues. Add more in Sentry once there is real traffic.
