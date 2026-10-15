# RepairMe One deployment handoff

This is a deployable source package for a hosted testing release. It is not a completed production company-management system. See `docs/implementation-status.md` for unfinished features and verification limits.

## Build and host

Extract the archive, run `npm ci`, then `npm run build`. Deploy through Netlify's Next.js build integration or Netlify CLI with a build; do not drag this source ZIP or the `.next` folder into a static hosting upload. Server-side authentication and workflow endpoints must run.

Build command: `npm run build`. Publish directory: `.next`. Node: 24. `netlify.toml` is included.

Set these values in the host's environment settings for build and server functions:

- `NEXT_PUBLIC_SUPABASE_URL`: your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: your publishable key.
- `APP_ORIGIN`: the exact hosted HTTPS origin, without a trailing slash.
- `ENABLE_FIXTURE_PREVIEW`: `false`.
- `SUPABASE_SERVICE_ROLE_KEY`: optional server-only secret for account invitations. Never use a `NEXT_PUBLIC_` prefix.

No local environment secrets, dependencies, compiled output or local databases are included. Provisioning scripts contain the team's supplied account UUIDs; keep this package private.

## Supabase

Existing project: do not rerun the installer or owner/team setup if already completed. The user reports the installer, ticket migration and team/owner configuration applied. Their screenshot shows eight active profiles. Provider login/recovery/MFA journeys have not yet passed a complete live test.

For a NEW project only: apply `supabase/install.sql` once, disable public signup, create Auth users, and review provisioning scripts before running them. Existing UUIDs belong to the original project.

After obtaining the hosted URL, set Supabase Site URL to that origin and allow `/auth/callback`, `/auth/callback?next=/account`, and `/auth/confirm` on that same origin. Configure the recovery email link as:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

Request fresh email links after changing URLs. Verify owner login, QR MFA enrollment, employee permissions, reset/invite emails and private downloads before using real company records.

## Brand and UI

Original supplied JPEG is at `public/brand/repairme-logo.jpeg`; the original artwork is preserved as a reference. A transparent PNG made with the built-in image tool is used in the UI, with a CSS light-lettering treatment on dark backgrounds. Sign-in and sidebar share the same accessible logo component. Navigation scrolls on shorter viewports. QA screenshots are under `docs/qa`.

## Known limits

Advanced invoice, leave-accrual, appeal-adjudication, payroll and complete accounting-report workflows remain unfinished. Lists use bounded queries; loaded totals are not complete financial reports. A hosted testing deployment is recorded below. Full development audit retains five high findings in tooling dependencies; consult the implementation status before operational release.

## Validation for this package

Passed: ESLint, strict TypeScript, 19 unit tests, six Playwright tests, and `npm run build`. All 15 fixture screens fit the mobile document width. Reviewed logo and sign-in screenshots on desktop/mobile. Prior database suite: 282 assertions with ticketing; no SQL changes in this branding release. Browser checks use fictional previews, not live employee credentials.

Transparent-logo revision: logo background removed using built-in imagegen. Saved as `public/brand/repairme-logo-transparent.png`. Prompt: remove only the pale background to transparent alpha; preserve icon, RepairMe lettering, tagline, layout and colors. Netlify login verified; workspace is not linked to a site. No hosting or publication performed.

## Hosted testing release

Published 13 October 2026: https://extraordinary-semolina-40421d.netlify.app/login . Deployment `6acd5f950cab335fb76faeb3` uses Netlify Linux cloud build and explicit Next.js plugin. Login/logo and unauthenticated route checks passed; see `docs/hosted-deployment.json`. Hosted Supabase auth URL configuration and real-user acceptance still need confirmation. Local Windows deployment bundling failed; use the Linux source build workflow for this configuration. Netlify build command is now `npm run build -- --webpack`.
