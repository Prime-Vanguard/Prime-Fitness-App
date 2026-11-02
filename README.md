# Prime Fitness

Invite-only training, nutrition, and accountability for Prime Vanguard members.

## Local development

Requires Node.js 22.12 or newer and npm. `package-lock.json` is the authoritative dependency lockfile.

```sh
npm ci
```

Keep your existing `.env` file. For a fresh checkout, copy `.env.example` to `.env` and fill in values from your own Supabase project. The browser and server must point to the same project. Only `VITE_*` values are public; the service role key belongs exclusively in the server environment. Environment files containing credentials are ignored by Git.

```sh
npm run dev
```

Open http://localhost:3000. If that port is occupied, use the URL Vite prints. Configure the local origin and `/reset-password` URL in your Supabase Auth redirect allowlist for OAuth and password recovery. Sessions use browser storage on the current origin; sign in again when switching domains.

## Checks and production build

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm start
```

The production build uses Nitro's Node server target and writes `.output/`. `npm start` runs `.output/server/index.mjs`, loading `.env` if present. On a host, configure the Supabase server variables in the hosting environment and provide the public `VITE_*` values at build time. This app includes server functions and needs a server runtime.

## Architecture

Fresh databases require [trusted first-owner provisioning](docs/owner-provisioning.md); public first signup cannot grant ownership after the new provisioning migration. Existing owners and invitation signup are preserved. See the [architecture follow-up](docs/architecture-improvements-2026-11-01.md) for the initial workout feature extraction and release boundaries.

The [authentication guide](docs/authentication.md) describes bilingual sign-in, invitations, recovery, and the callback URLs to verify before deployment.

- TanStack Start and Router, React, TypeScript, Vite, Tailwind CSS, and TanStack Query.
- Your external Supabase project supplies Auth, Postgres, and private photo storage.
- Database migrations are in `supabase/migrations/`; this local setup does not apply migrations or change remote data.
- Authenticated routes live in `src/routes/_authenticated/`. Server functions receive bearer tokens through `src/lib/auth-attacher.ts`.
- Role and access rules are documented in `AGENTS.md`.
- The original product plan is preserved in `docs/prime-fitness-full-build-plan-2026-10-23.md`; implementation tracking is in `roadmap.md`. Plan items and checkmarks are historical scope, not proof that every flow is tested.

Edit the source files directly and use your own Git and hosting workflow.

The [member experience guide](docs/member-experience.md) documents training tools, offline sync, nutrition favorites, the Vanguard roadmap, Pod sharing, shields, photo comparison, and PWA installation. Install and offline-refresh checks use the production build (`npm run build`, then `npm start`).

The [redemption and photo-history follow-up](docs/redemption-and-photo-history-fixes.md) covers durable purchase retries, older-photo paging, cross-page comparisons and signed-URL recovery. Run `npm run test:redemptions` for the dedicated database checks. The [training-depth report](docs/training-depth-offline.md) records implementation and remaining release gates.

The [UX/UI improvement plan](docs/ux-ui-improvement-plan.md) tracks the workout and application redesign, including the licensed Gym Visual catalogue. The [first implementation report](docs/ux-ui-implementation.md) describes exercise-card logging, focused navigation, set editing/Undo and the remaining delivery work.
