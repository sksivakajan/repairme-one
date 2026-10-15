# Development Supabase connection

Project: https://bccrnchpssygxfkgorrb.supabase.co

Read-only checks on 13 October 2026:

- Auth settings endpoint: HTTP 200 with the supplied publishable key.
- Public signup: currently enabled (`disable_signup: false`). Disable **Allow new users to sign up** in Authentication settings before operational use. A missing application signup page alone does not disable the provider API.
- Employee REST endpoint: HTTP 404. RepairMe schema is not yet installed/exposed.
- No Auth users or hosted application data were created or changed.

The publishable key is in ignored `.env.local`. It grants no management or SQL migration access. No service-role credential is present.

Required next steps:

1. Review `supabase/install.sql` and apply it once in the development project's SQL Editor. Do not run the local test bootstrap or fictional test fixtures against this project.
   The current bundle contains ten migrations. If the original eight were already applied, apply only `supabase/migrations/202610130009_provisioning_fix.sql`.
2. Disable public registration. Configure password requirements and provider abuse protection. Use custom SMTP for invitations/recovery; configure appropriate delivery quotas.
3. Set Site URL to `http://localhost:3100` and allow `http://localhost:3100/auth/callback` plus `/auth/callback?next=/account`. Add the final Netlify URLs only when a deployment is authorized.
4. Create/invite the first real owner through the provider Auth Dashboard. Review and complete `supabase/bootstrap-owner.sql.example` with their Auth UUID and real directory details. Do not create known demo credentials.
5. Sign in and enroll TOTP MFA. Privileged mutations require AAL2.
6. Add `SUPABASE_SERVICE_ROLE_KEY` only to the local server environment (or authorized host secret store) if app-managed invitations are needed. Never put this key in a `NEXT_PUBLIC_` variable, source control, browser code, or chat.
7. Test invitations, recovery, account disabling, MFA, and real authorized/unauthorized private downloads using disposable development accounts. These hosted checks remain pending.
8. For server-side invite/recovery confirmation, configure email templates to use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` (or `type=recovery`) and allow this exact endpoint. This handler verifies the provider token and sends the user to the account/password screen. Keep the supported PKCE callback for password sign-in recovery redirects. Test actual delivered links; no email flow is claimed operational yet.

Alternative: configure a server-only database connection locally to allow CLI migrations; never paste a database password into chat.

## Ticketing upgrade

If migrations 001?009 are installed, apply only `supabase/migrations/202610130010_ticketing.sql`. Do not rerun the full installer on an existing database. Ticketing remains unverified against the hosted provider until this migration is applied.
