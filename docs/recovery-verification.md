# Password recovery verification — 2026-10-13

Deployed recovery error handling to Netlify deployment `6acd651d1c92aff903cca3d1` (ready).

One browser request through the hosted recovery form for the registered owner returned HTTP 429 with the recovery email limit message. Inbox delivery and reset completion are not verified. Supabase email sending limits currently block the request. Configure custom SMTP in Supabase Authentication for employee delivery; the default sender restricts recipients to organization members and currently permits two emails per hour.

Validation: 22 unit tests passed, TypeScript passed, ESLint passed (generated .netlify adapter output excluded).

The app preserves generic account eligibility messaging on successful requests, reports provider failures, and logs only provider error code/status.

## Recovery link routing

Valid token-hash confirmation and PKCE callbacks target `/account`, the new-password page. Privileged users complete MFA first and now return to `/account` after verification. Invalid or expired links go to `/recovery?error=invalid_link` with guidance rather than silently returning to login.

Supabase dashboard configuration (requires project administrator):
- Site URL: https://extraordinary-semolina-40421d.netlify.app
- Reset Password template link: `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>`
- Request a new recovery email after saving; old email links do not change.

Validation: 25 unit tests, TypeScript and ESLint passed. Actual email-link completion remains unverified; provider rate limiting blocked the earlier live request.
