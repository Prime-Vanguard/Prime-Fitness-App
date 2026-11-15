# Prime Fitness contributor guidance

## Working in this repository

- Preserve existing work and check the working tree before editing. Follow the user's current instructions about commits, pushes, deployments and hosted changes.
- Keep changes focused. Add comments that explain non-obvious decisions, invariants or recovery behavior; avoid restating the code.
- Report what changed, the checks run and their results, remaining limitations, and the next relevant work. Do not claim unrun checks passed.
- `src/routes` contains routes; `src/components` shared UI; `src/features` feature modules; `src/lib` shared utilities; `supabase/migrations` database history; `e2e` browser tests; and `scripts` verification and build tools.
- See `docs/member-experience.md` for feature behavior and additional verification. For the premium redesign, use `docs/premium-ui-ux-refactor-plan.md` and keep `docs/premium-ui-ux-implementation.md` current.

## Security and backend

- The backend is the user's external Supabase project; preserve its ownership and existing data. Inspect the current schema and hosted/repository migration drift before database or authentication changes. Add forward migrations; do not rewrite applied migration history. Treat hosted changes as distinct from local verification.
- Roles live in `public.user_roles`. Permission helpers `has_role`, `is_admin` and `manages_member` live in the non-exposed `private` schema; policies call them as `private.*` to avoid recursion and self-escalation. Review the latest migrations rather than relying on historical definitions.
- Signup is invite-only, enforced by the `handle_new_user` trigger on `auth.users`. A fresh installation requires trusted SQL approval and an Admin API owner-creation request; ordinary first signup cannot bootstrap super_admin. Preserve existing owners and keep provisioning credentials out of browser code.
- Signed-in pages live under `src/routes/_authenticated` (client-only gate); server functions receive the bearer token through `src/lib/auth-attacher.ts`. Database policies remain authoritative.
- XP and PV approvals are enforced by database triggers; preserve server enforcement and do not introduce publicly exposed privileged functions. Paused members (`profiles.access_active=false`) are blocked from writing by restrictive insert policies using `private.is_active`; the shell shows a paused screen.
- Never expose service-role or other private credentials in browser code, screenshots, logs or public assets. `VITE_` values are included in the client bundle and must be treated as public. Do not print `.env` contents.
- RLS identity checks use `(SELECT auth.uid())`; row-independent role/access helper calls use scalar subqueries too. Keep row-dependent ownership/management checks correlated, preserve restrictive policies, and avoid overlapping permissive policies for a role/operation.
- Cover foreign keys with a suitable leading-column index. Treat zero-scan index notices as review input; retain indexes required by app queries or referential operations. Run `npm run test:performance` when changing policies or index coverage.

## Offline and data integrity

- Active workout drafts live in member-scoped IndexedDB. Commit local changes before claiming they are saved; retain stable set UUIDs and deletion tombstones through retries. Finish syncing sets before marking a session finished so server XP triggers see the completed logs.
- `WorkoutSync` owns periodic workout retries. Member queues retry every 15 seconds; refresh member caches on scoped server-acceptance notices, focus/reconnect and a 60-second foreground fallback. Do not invalidate after an empty flush or put record payloads in cache-notice messages. See `docs/performance/sync-traffic-2026-11-02.json`.
- Streak shields are limited to two per calendar month by a server trigger, using Cairo dates. Pod feed sharing is a separate, default-off opt-in and must respect current Pod membership and opt-out on every read.
- The production service worker may cache public assets and the client-only training shell; never cache auth/API responses, photos or mutation requests. Preserve frozen program history and server-enforced rewards.

## UI and accessibility

- Preserve English and Arabic, RTL behavior, responsive layouts, accessible keyboard interaction, reduced motion and existing recovery states. Check affected screens at relevant phone and desktop sizes.
- For Stitch work, compare the corresponding reference and equivalent application state. Document missing assets or unsupported behaviors rather than inventing data; record comparison evidence and outstanding acceptance in the tracker. Keep private data out of captures.

## Verification and delivery

- Choose checks appropriate to the change. Typical code checks include `npm run typecheck`, targeted lint and relevant `npm test` or focused Vitest tests. For workout/offline changes consider `npm run test:reliability` and focused browser tests; for security/schema changes consider `npm run test:security`, `npm run test:database` and `npm run test:performance` as applicable. Some checks require a configured local database or other dependencies; report unavailable checks and why.
- Use relevant Playwright tests for changed flows, including keyboard, responsive and English/Arabic RTL coverage. PWA and offline-refresh browser checks require a production build. Physical-device and screen-reader checks must not be inferred from automated tests.
- The Pages frontend builds with `npm run build:pages` at `/Prime-Fitness-App/`; use `appPath` for public assets/callback URLs and application-relative router destinations. Training suggestions call the RLS-guarded `get_training_context` RPC directly. Publish only `dist/client`, never `dist/server` or `.output/server`.
