# Deployment review

A hosted testing release is published on the existing Netlify Free site. No paid plans, custom domains, or automatic billing were enabled.

The committed `netlify.toml` uses `npm run build`, `.next`, Node 24, and disables fixture preview. Netlify documents modern Next.js support through its OpenNext adapter. Review provider adapter compatibility with the locked Next.js version before release. Do not use static export: authentication and transactional server routes need server rendering.

## Release steps

1. Complete the migration, owner bootstrap, authentication configuration, and hosted integration checks in `provider-verification.md`.
2. Resolve outstanding items in `implementation-status.md`; this development release is not approved for production operations.
3. Run `npm ci`, lint, typecheck, unit tests, database/security tests, browser tests, and production build.
4. Create a Netlify Free site with a provider subdomain only when authorized. Use a deploy preview for review. Configure server environment variables from `.env.example`; never expose the service-role key.
5. Set `APP_ORIGIN` to the exact HTTPS deployment origin. Configure the matching Supabase Site URL and callback allowlist. Do not use a broad production wildcard or trust arbitrary callback destinations.
6. Verify login, MFA, invite delivery, recovery delivery, disabled-session denial, private download denial, and independent approval/payment against this exact deployment.
7. Review the concrete preview before authorizing production publication. No live bank transfer integration is present.

## Free-tier checks

Official documentation checked on 13 October 2026; quotas can change. Verify account-specific limits again before deploying.

- [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase): Free database limit listed as 500 MB/project, 50,000 monthly active users, and 1 GB storage. Free projects may pause; do not assume hosted automatic backups. Monitor provider usage and availability.
- [Netlify credit-based plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) and [credit consumption](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/): Free credits are finite; production deployments consume credits. Check the current plan and account dashboard rather than applying legacy plan limits.
- [Netlify Free](https://www.netlify.com/pricing/): Free projects can pause when monthly usage is exhausted. Do not enable auto recharge or upgrade a plan as part of setup.
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client): supported `@supabase/ssr` cookie clients and `getClaims()` identity validation are used.
- [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/): deployment compatibility reference.

Employee accounts use Supabase Auth and application roles. They do not require individual Netlify collaborator seats.

## Operational limits and portability

Server operations are bounded. No in-memory queue, continuous polling, or long-running backend is used. Lists currently load up to 100 authorized rows and paginate locally; database-backed pagination and scoped aggregate endpoints must replace this for larger datasets. No displayed aggregate should be treated as a complete financial report beyond the loaded scope.

Next.js can be self-hosted with `npm run build` / `npm start` behind HTTPS. PostgreSQL migrations are portable, while Auth and Storage require Supabase or explicit replacement adapters. No Python backend is required.

Production dependency auditing should use `npm audit --omit=dev`. The current development toolchain has an advisory chain through ESLint's glob dependencies; do not downgrade the application framework automatically to satisfy an unrelated development-tool recommendation.

## Hosting configuration revision

The deployment command uses `npm run build -- --webpack` and explicitly registers `@netlify/plugin-nextjs`. Local Windows adapter bundling failed on a middleware path, so source is uploaded without environment files to Netlify's Linux build API. The adapter must process `.next`; publishing raw `.next` as static files is not a working deployment.

Site: `https://extraordinary-semolina-40421d.netlify.app`. The user explicitly approved disabling the Netlify team-only gate in favor of RepairMe's own authentication. The gate is temporarily kept enabled while the corrected build is verified. Hosted acceptance results will be recorded once available.

## Published testing release ? 13 October 2026

URL: https://extraordinary-semolina-40421d.netlify.app
Deploy ID: `6acd5f950cab335fb76faeb3`.

Built successfully on Netlify Linux with explicit Next.js adapter. Live login and transparent logo respond HTTP 200. Fixture preview returns 404. Unauthenticated command requests return 401. A real browser follows the protected dashboard to `/login`, loads the logo and reports no page errors. Netlify team-only protection was disabled after the user's explicit approval; application authentication remains required.

Supabase must use this exact HTTPS origin for Site URL and allow `/auth/callback`, `/auth/callback?next=/account`, and `/auth/confirm`. Confirmation of these dashboard changes and real-user login/recovery/MFA/private-download verification remain pending. No employee passwords were requested or used by the agent.
