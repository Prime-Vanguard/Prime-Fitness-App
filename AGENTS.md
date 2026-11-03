## Prime Fitness architecture

- Backend is the user's external Supabase project; preserve ownership of the existing database.
- Roles live only in public.user_roles; RLS uses security-definer has_role / is_admin / manages_member to avoid recursion and self-escalation.
- Signup is invite-only, enforced in the handle_new_user trigger on auth.users. A fresh installation requires trusted SQL approval and an Admin API owner-creation request; ordinary first signup cannot bootstrap super_admin. Preserve existing owners and keep provisioning credentials out of browser code.
- Signed-in pages live under src/routes/_authenticated (client-only gate); server functions get the bearer token via src/lib/auth-attacher.ts.
- Permission helpers (has_role, is_admin, manages_member) live in the non-exposed `private` schema; policies call them as private.*. Why: keeps security-definer functions off the public API.
- Privileged state changes (XP, PV approvals) are enforced by DB triggers, not callable RPCs. Why: no security-definer function is exposed to signed-in users.
- Paused members (profiles.access_active=false) are blocked from writing by RESTRICTIVE insert policies using private.is_active; the shell shows a paused screen. Why: membership pause must hold server-side.
- Active workout drafts live in member-scoped IndexedDB. Commit local changes before claiming they are saved; retain stable set UUIDs and deletion tombstones through retries. Finish syncing sets before marking a session finished so server XP triggers see the completed logs.
- Streak shields are limited to two per calendar month by a server trigger, using Cairo dates. Pod feed sharing is a separate, default-off opt-in and must respect current Pod membership and opt-out on every read.
- The production service worker may cache public assets and the client-only training shell; never cache auth/API responses, photos, or mutation requests.
- `WorkoutSync` owns periodic workout retries. Member queues retry every 15 seconds; refresh member caches on scoped server-acceptance notices, focus/reconnect and a 60-second foreground fallback. Do not invalidate after an empty flush or put record payloads in cache-notice messages. Request-count evidence is in `docs/performance/sync-traffic-2026-11-02.json`.
- Feature behavior and verification commands are documented in docs/member-experience.md. PWA/offline-refresh browser checks require a production build.
- RLS identity checks use `(SELECT auth.uid())`; row-independent role/access helper calls use scalar subqueries too. Keep row-dependent ownership/management checks correlated, preserve restrictive policies, and avoid overlapping permissive policies for a role/operation.
- Cover foreign keys with a suitable leading-column index. Treat zero-scan index notices as review input; retain indexes required by app queries or referential operations. Run `npm run test:performance` when changing policies or index coverage.
