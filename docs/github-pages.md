# GitHub Pages testing frontend

Test address: `https://prime-vanguard.github.io/Prime-Fitness-App/`.
The frontend uses the existing hosted Supabase project. GitHub Pages serves only
`dist/client`; the generated server directory is never published.

## One-time account settings

1. In the private repository's **Settings → Pages**, choose **GitHub Actions** as
   the build source. Private organization repositories require GitHub Team or
   Enterprise. Keep the repository private; if the plan does not support Pages,
   choose a suitable plan or another staging host.
2. In Supabase **Authentication → URL Configuration**, add
   `https://prime-vanguard.github.io/Prime-Fitness-App/**` to the redirect allowlist.
   Retain existing development/production entries. This covers confirmation and
   password-recovery callbacks. The staging wildcard is limited to this app's prefix.
3. Open **Actions → GitHub Pages test site → Run workflow** after activation,
   or push a change and allow CI to pass. If the `github-pages` environment has
   required reviewers, its deployment must be approved in GitHub.

GitHub and Supabase administration settings cannot be changed through the current
connected repository tools. No organization plan or repository visibility is
changed by this setup.

## Build and deployment

`pages.yml` deploys successful `main` push CI runs, and supports manual dispatch.
It rebuilds the exact successful commit from source and uploads only the static
directory. It does not download or execute artifacts from a different workflow.
The deployment job has Pages/OIDC permissions; the build job has read-only access.

`config/pages-public.json` contains the existing project's public browser URL and
publishable key. These values are intended to be visible in a browser. Optional
repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` override
them, for example when using a separate staging backend. Never provide a secret key
or service-role key. The build validates the key type and scans published output
for private credential markers. `.env.pages.local` is generated locally and ignored.

The default Node server build continues to use `npm run build`. Pages uses
`npm run build:pages`, with TanStack SPA mode and `/Prime-Fitness-App/` as its base.
It generates directory index files for static routes and `404.html` for dynamic
member URLs. GitHub returns HTTP 404 for an initial dynamic URL, but the shell
loads the requested client route without redirecting or dropping auth fragments.
Static pages include a no-index directive for this test site.

Assets, confirmation/recovery destinations, manifest start URL and service-worker
scope all include the project prefix. Cache names also include the scope, so this
site does not delete another app's caches on the same GitHub origin. Authenticated
responses, private photos and mutation requests remain outside service-worker caches.
Training suggestions fetch the existing RLS-guarded `get_training_context` RPC with
the signed-in member token and use the shared pure recommendation calculation.

## Verification and local preview

```sh
npm run build:pages
node scripts/serve-pages.mjs
```

Open `http://127.0.0.1:3174/Prime-Fitness-App/`. The preview emulates GitHub directory
redirects and 404 documents instead of silently rewriting every URL to the app.
Stop that server before running `npm run test:pages`, which starts its own server.
The additional CI job builds with a disposable invalid Supabase domain and runs
static-hosting browser tests. Regular application tests still cover the Node build.

After deployment, test invitation/confirmation emails, password reset, member and
coach permissions, workout/nutrition writes, imports, photos and offline recovery
against your intended test accounts. Hosted email delivery and backend migration
readiness cannot be established by mocked browser tests. Use test records deliberately:
this frontend connects to the configured existing database.

References: [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages),
[TanStack SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode),
[Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
