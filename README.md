# RepairMe One

An internal RepairMe workspace built with Next.js App Router, strict TypeScript, Tailwind, Radix Dialog, Supabase SSR/Auth/PostgreSQL/private Storage, and Zod. Branding follows the supplied black/yellow/white references.

This is a locally tested development release, **not a completed production system**. See [implementation status](docs/implementation-status.md) for workflow coverage, remaining work, and provider blockers.

## Run locally

Node 24 is used in development and Netlify configuration. Dependency versions are locked in `package-lock.json`.

```powershell
npm ci
Copy-Item .env.example .env.local
# Set the Supabase URL, publishable key, and APP_ORIGIN in .env.local.
npm run dev -- --port 3100
```

- Connected sign-in: http://localhost:3100/login
- Development-only fictional preview: http://localhost:3100/preview/dashboard
- Connected workspace: http://localhost:3100/dashboard

The supplied development project is configured in the ignored local environment file. It had no RepairMe tables when first checked. Review [provider setup](docs/provider-verification.md), apply [the migration bundle](supabase/install.sql), and bootstrap the first real owner. Public registration must be disabled at the provider. There are no demo passwords or production seed employees.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Database tests use PostgreSQL directly, with a clearly isolated Auth/Storage claim harness. They do not certify hosted Supabase integration.

```powershell
$env:PGHOST='127.0.0.1'
$env:PGPORT='55432'
$env:PGUSER='postgres'
$env:PGDATABASE='postgres'
# On a fresh dedicated local database, apply local-bootstrap.sql, then migrations in filename order.
node scripts/test-database.mjs
node scripts/test-concurrency.mjs
node scripts/test-recovery.mjs
node scripts/generate-db-types.mjs
```

The concurrency and recovery scripts create separate test databases. Recovery copies fictional files only. Neither script accepts a remote production host.

## Architecture

- `src/app/(auth)`: sign-in, recovery, password change, MFA.
- `src/app/(portal)`: authenticated portal, with independently checked section permissions.
- `src/app/api`: origin-checked, identity-validated command, invitation, and document routes.
- `src/lib/supabase`: supported cookie-based SSR clients and generated database types.
- `src/lib/permissions`, `validation`, `workflows`: role boundaries, Zod validation, deterministic rules.
- `supabase/migrations`: nine ordered, locally executed migrations; 42 domain tables.
- `supabase/tests`: RLS, transactional workflows, immutable records, and disabled-session tests.
- `tests/unit`, `tests/e2e`: formula/rule tests and browser checks.

Business mutations run in bounded PostgreSQL transactions. Auth identity and roles never come from browser metadata. All application tables use RLS; direct application INSERT/UPDATE/DELETE privileges are revoked. Security-definer functions use an empty search path and explicit authorization.

Money is exact PostgreSQL `numeric`; the deterministic money helper uses minor-unit `bigint`. Timestamps are UTC, displayed in Asia/Colombo. Working weekdays and break policy start unconfigured. The monthly company leave allowance is separate from statutory and medical leave policy setup.

## Deployment and operations

See [deployment](docs/deployment.md), [recovery](docs/recovery.md), [permissions](docs/permissions.md), and [workflow specifications](docs/workflows.md). No deployment has been published. No paid plans or automatic billing were enabled. Statutory payroll calculations, banking transfers, and GitHub integration are disabled.
