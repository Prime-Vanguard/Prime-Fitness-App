# Continuous integration

The private repository runs `.github/workflows/ci.yml` on pushes to `main`,
pull requests targeting `main`, and manual dispatches. Three independent jobs run:

- **Code quality and unit tests:** TypeScript, ESLint, repository formatting and Vitest.
- **Database and security:** every existing functional database suite plus the owner
  provisioning operator tests, serially in isolated PGlite databases.
- **Production build and browser tests:** a production build followed by the mobile
  Chrome Playwright suite, including offline/PWA recovery scenarios.

The opt-in request-count benchmark is excluded from normal browser runs. The separate
`performance.yml` workflow runs it alongside policy/access and latest-schema training
benchmarks every Monday at 02:30 UTC, and supports manual dispatch. The cron remains
fixed in UTC through Cairo daylight-saving changes. It compares against the committed
historical request baseline without updating that baseline.

## Credentials and artifacts

No repository secrets or hosted database access are required. Browser jobs copy
`.env.ci.example` to an ignored `.env`, using an invalid test domain and placeholder
publishable key. Playwright supplies synthetic members and mocked HTTP responses.
Never replace these with production credentials. Database jobs do not apply hosted
migrations. The existing PGlite suites are not a full Supabase/Auth integration test.

Workflow tokens have read-only repository access, checkout does not retain credentials,
and actions are pinned to immutable commits. npm downloads are cached against the
lockfile. Superseded runs are cancelled and every job has a timeout.
The repository `.npmrc` explicitly enables normal peer dependency resolution, overriding
machine-level legacy settings so local installs and Linux runners use the same graph.

Browser reports/traces are retained for seven days; performance evidence for fourteen.
Only the explicit synthetic-test output paths are uploaded, never `.env` or the general
`artifacts/` directory. Failed tests retain traces; reports are available from the Actions
run page. Workflows do not deploy, publish packages or modify the live database.

## Running locally and maintaining CI

Use Node 22.23.4 and the committed npm lockfile:

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test -- --pool=threads --maxWorkers=2 --no-file-parallelism
npm run test:database
npx playwright install --with-deps chrome
npm run build
npm run test:e2e
```

Keep your existing local `.env`; the disposable copy step is for clean CI checkouts.
Production browser tests start their own server on port 3173. Stop an existing test
server before rebuilding. Performance scripts can regenerate local report files;
review changes rather than automatically committing benchmark results.

After successful runs, repository administrators can require the three CI job checks
in a `main` branch ruleset (subject to the organization's GitHub plan). Workflow files
alone do not enforce branch protection. Physical-device checks and a full local Supabase
stack remain release gates; passing CI is not release approval.

References: [Playwright CI setup](https://playwright.dev/docs/ci-intro),
[GitHub checkout](https://github.com/actions/checkout),
[Node setup](https://github.com/actions/setup-node).
