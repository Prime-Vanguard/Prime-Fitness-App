# Prime Fitness

Invite-only training, nutrition, and accountability for **Prime Vanguard** members. Built with React, TanStack Start, TypeScript, and Supabase, with English/Arabic interfaces, RTL layouts, and durable offline logging.

[Quick start](#quick-start) · [Features](#features) · [Architecture](#architecture) · [Checks](#checks) · [Deployment](#deployment) · [Documentation](#documentation)

## Quick start

Use **Node.js 22.12+** and npm; CI uses Node 22.23.4. `package-lock.json` is the authoritative lockfile.

From the `Prime-Fitness-App` directory:

1. Install dependencies:

   ```sh
   npm ci
   ```

2. Keep your existing `.env`. For a fresh checkout, copy [.env.example](.env.example) to `.env` and configure the intended Supabase project:

   | Variable                        | Used by                               |
   | ------------------------------- | ------------------------------------- |
   | `VITE_SUPABASE_URL`             | Browser: public project URL           |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser: public publishable key       |
   | `SUPABASE_URL`                  | Node server: same Supabase project    |
   | `SUPABASE_PUBLISHABLE_KEY`      | Node server: same publishable key     |
   | `SUPABASE_SERVICE_ROLE_KEY`     | Server-only administrative operations |

   Keep service-role/secret keys out of `VITE_*`, browser code, commits, and public artifacts. Environment files containing credentials are ignored by Git.

3. Start development:

   ```sh
   npm run dev
   ```

   Open **http://localhost:3000**, or the fallback URL printed by Vite. Development/build hooks prepare the local barcode/OCR runtime assets automatically.

Use an existing invited account. Starting the frontend does **not** apply migrations or provision an owner. A new database requires the [trusted first-owner workflow](docs/owner-provisioning.md), followed by normal invitations. Configure local confirmation/recovery redirects in Supabase Auth; see [authentication](docs/authentication.md).

## Features

| Area                       | Implemented capabilities                                                                                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Training**               | Programs with frozen versions, session scheduling/rotations, editable actual weights, kg/lb conversion, warm-ups, plate calculator, swaps, supersets, timed/unilateral/drop sets, rest alerts, history, and coach-controlled progression suggestions. |
| **Exercise guidance**      | A 1,324-entry source catalogue reconciled with existing exercises, equipment/muscle filters, English instructions, Arabic translation drafts, external demonstration references, and a coaching/editorial workflow.                                   |
| **Nutrition**              | Food and quick-macro logging, custom foods, favorite meals, water tracking, barcode lookup, and on-device nutrition-label OCR with review before saving.                                                                                              |
| **Progress**               | Strength records, detailed front/back muscle-volume diagrams, measurements, wellness check-ins, and private photo comparisons.                                                                                                                        |
| **Accountability**         | The 100-level Vanguard progression, rank emblems, reward shop, shareable achievement cards, streak shields, Pods, leaderboards, and opt-in activity sharing.                                                                                          |
| **Friends & challenges**   | Exact member-code discovery, recipient-approved friendships, blocking, and opt-in shared cardio-minute/workout-day goals, separate from Pods.                                                                                                         |
| **Cardio & HIIT**          | Activity-specific metrics, interval timers, history, and progress views, kept separate from strength volume and estimated 1RM.                                                                                                                        |
| **Recovery & portability** | Durable workout/nutrition/check-in storage, sync/conflict controls, training-history imports, personal backups, and PWA installation.                                                                                                                 |

**Availability depends on permissions, feature flags, and the deployed frontend/backend versions.** The November 7 rollout records scanning, cardio, and social as staff/pilot features; see [rollout details](docs/experience-expansion.md). Feature implementation does not imply general member release.

Important behavior:

- Imported exercise guidance remains **pending editorial review**. Arabic translations are drafts; the English original remains available. The [catalogue guide](docs/full-exercise-catalogue.md) records coverage, provenance, storage measurements, and the encoding correction.
- Images/GIFs are externally hosted references. Written metadata uses the source's MIT license; Gym Visual media has separate licensing. Thumbnails and on-demand playback reuse the existing media flow.
- Offline writes persist before success feedback. Queued changes remain local until accepted; conflicts require resolution. Social actions need connectivity to recheck privacy and blocks.
- XP and rewards are enforced by the database. Imported training history and the new cardio/shared-challenge features do not create additional XP awards.
- PWA/offline recovery requires an initial online preparation. First-time OCR runtime downloads and external demonstrations also require connectivity. Camera, haptics, and background audio vary by device/browser.

## Architecture

**Frontend:** React, TanStack Start/Router/Query, TypeScript, Vite, Tailwind CSS, and shared UI components. **Backend:** the existing external Supabase project for Auth, Postgres, Storage, guarded RPCs, and Edge Functions.

```text
src/
  routes/                 File-based routes; authenticated application shell
  features/               Workouts, nutrition, imports, scanning, cardio, social
  components/             Shared UI and application components
  hooks/                  Query, preference, and lifecycle hooks
  lib/                    Calculations, persistence, sync, and shared operations
  integrations/supabase/  Typed browser/server clients and generated database types
supabase/
  migrations/             Forward-only schema and permission changes
  catalogue/              Deterministic exercise-content seed chunks
  functions/              Hosted Edge Functions
e2e/                      Playwright scenarios and fixtures
scripts/                  Builds, data preparation, and isolated database checks
docs/                     Product, architecture, operations, and verification guides
```

Authorization lives in database policies and guarded operations; frontend feature flags do not grant access. Roles are stored in `user_roles`, private permission helpers stay outside the exposed API, and paused membership blocks protected mutations. Server functions receive bearer tokens through `src/lib/auth-attacher.ts`.

Local records are scoped by project/member, with stable IDs and retry/conflict handling. The service worker caches approved public assets and client shells; authenticated responses, private photos, and mutation requests stay out of its caches. See [AGENTS.md](AGENTS.md) for implementation constraints.

## Checks

| Command                             | Purpose                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm test`                          | Unit/component tests                                                                              |
| `npm run typecheck`                 | TypeScript validation                                                                             |
| `npm run lint`                      | ESLint and code-style checks                                                                      |
| `npm run format:check`              | Repository formatting                                                                             |
| `npm run test:database`             | Complete isolated database suite, including security, catalogue, recovery, and owner provisioning |
| `npm run test:catalogue`            | Full catalogue coverage, Arabic fidelity, repeat imports, and history preservation                |
| `npm run test:catalogue:encoding`   | Windows-safe SQL transport and targeted encoding-repair regression                                |
| `npm run test:performance`          | Historical policy/access comparisons and index checks                                             |
| `npm run test:training:performance` | Latest-schema training query benchmarks                                                           |
| `npm run test:e2e`                  | Production Node-build mobile browser scenarios                                                    |
| `npm run test:pages`                | Static Pages-build browser scenarios                                                              |

Build with `npm run build` before Node browser tests, or `npm run build:pages` before Pages tests. Local Playwright configuration uses installed **Google Chrome** and starts its own server on **3173** or **3174**, respectively; stop an existing server on that port first. [CI setup](docs/ci.md) covers browser installation, synthetic environments, and diagnostics.

Database checks use isolated Postgres/PGlite; browser suites use synthetic API responses. They do not apply hosted migrations or prove real email delivery, multi-device behavior, or physical-device acceptance. Performance commands can update local evidence files; review those changes before committing.

## Deployment

Choose the build for the intended host:

| Target                         | Build                 | Run/publish                                                                                                     |
| ------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Node server**                | `npm run build`       | `npm start` runs `.output/server/index.mjs`; deploy the `.output/` build with the required runtime environment. |
| **GitHub Pages test frontend** | `npm run build:pages` | Publish **only `dist/client`** at `/Prime-Fitness-App/`; Supabase services remain hosted separately.            |

Public `VITE_*` values are compiled at build time. The Node start command loads `.env` if present; hosted runtime variables must point to the same intended backend.

Pages resolves public configuration through `config/pages-public.json` and optional repository-variable overrides, validates it, and scans the generated output for private credential markers. Never publish `.output/server` or `dist/server` to Pages. The test frontend uses the configured database—testing writes can affect its records.

For a local Pages preview:

```sh
npm run build:pages
node scripts/serve-pages.mjs
```

Open **http://127.0.0.1:3174/Prime-Fitness-App/**. See the [Pages guide](docs/github-pages.md) for callback URLs, routing, service-worker scope, and deployment settings.

CI checks pull requests and pushes; the Pages workflow deploys successful `main` push CI runs and supports manual dispatch. Hosted database changes remain separate from frontend deployment. Review migration mappings and content-seed instructions before applying changes; do not reset the existing backend to match a local checkout.

## Documentation

| Start here for…                                                               | Guide                                                                                                                                                                |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Member flows, offline logging, rewards, and PWA use                           | [Member experience](docs/member-experience.md)                                                                                                                       |
| Training guidance, logging models, scheduling, imports, and offline contracts | [Training depth & offline experience](docs/training-depth-offline.md)                                                                                                |
| Scanning, cardio, friends/challenges, rollout flags, and release limitations  | [Experience expansion](docs/experience-expansion.md)                                                                                                                 |
| Catalogue imports, Arabic drafts, media references, and storage               | [Full exercise catalogue](docs/full-exercise-catalogue.md) · [Dataset provenance](docs/exercise-dataset.md)                                                          |
| Sign-in, invitations, recovery, and fresh owner provisioning                  | [Authentication](docs/authentication.md) · [Owner provisioning](docs/owner-provisioning.md)                                                                          |
| Testing and deployment                                                        | [CI](docs/ci.md) · [GitHub Pages](docs/github-pages.md)                                                                                                              |
| Architecture changes and reliability work                                     | [Architecture follow-up](docs/architecture-improvements-2026-11-01.md) · [Review fixes](docs/review-fixes-2026-11-01.md)                                             |
| Security, photo privacy, and recovery fixes                                   | [Security](docs/security-fixes.md) · [Photos & sessions](docs/photo-and-session-fixes.md) · [Redemption & photo history](docs/redemption-and-photo-history-fixes.md) |
| UI/UX direction and implementation                                            | [Plan](docs/ux-ui-improvement-plan.md) · [Implementation](docs/ux-ui-implementation.md) · [Alignment](docs/ui-alignment.md)                                          |
| Query evidence and historical comparisons                                     | [Performance](docs/performance/README.md)                                                                                                                            |
| Original scope and delivery tracking                                          | [Build plan](docs/prime-fitness-full-build-plan-2026-10-23.md) · [Roadmap](roadmap.md)                                                                               |

Plans and older reports describe their recorded scope and verification date; they are not a guarantee of current deployment or release approval. Third-party notices, including exercise metadata and muscle-diagram attribution, are retained in [public/legal](public/legal/).
