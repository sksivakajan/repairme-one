# RepairMe One implementation status

Updated 13 October 2026. This is a working development release with connected transactional slices, not a completed production system. A hosted testing deployment is published; real-user acceptance remains pending.

Repository inspection found an empty workspace and no initial AGENTS.md. Next.js later generated framework guidance; its route/proxy documentation was read before further changes.

## Phase checklist

| Phase                              | Implemented and locally exercised                                                                                                                                                                                                                                          | Remaining work / gate                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Foundation                       | SSR claims validation, login/logout/recovery/password code, MFA enrollment/verification code, account invite/provisioning, disabled-session denial, multi-role database authorization, RLS on 45 tables, private HR separation, directory, first-owner bootstrap, settings | Hosted migration and first real owner; provider MFA/email delivery tests; complete company-policy/settings editors                                                               |
| 2 Projects/tasks                   | Project creation/membership, assignment, board/list, deliverable submission, independent quality-rated acceptance, review rejection, version checks, history, unfinished scope revision                                                                                    | Full project lifecycle editor, dependencies/comments/attachments authoring, richer scope-review experience                                                                       |
| 3 Logs/attendance                  | Assigned-task submission, timestamp validation, overlap exclusion, independent log review, explicit check-in/out, one open attendance record, correction schema/commands                                                                                                   | Rejected-log resubmission and approved-log adjustment workflow, persistent timer, configured schedule comparisons and unusual-duration flags, correction UI                      |
| 4 Leave/onboarding                 | Configured weekdays/holidays in leave calculation, half days, overlap rejection, independent reporting-manager decision, exact-once deduction, reviewed cancellation/reversal, immutable adjustments, onboarding checklist/provisioning                                    | Configurable accrual/proration/carry-forward engine, pending reservations, full leave-year policy and holiday editors, offboarding administration UI                             |
| 5 Performance                      | Formula v1.0, missing-evidence behavior, eligible accepted task evidence, approved-leave adjustment rationale requirement, reviewer assessment, employee response, immutable finalization, appeals table/submission, points ledger constraints                             | Independent appeal adjudication and versioned replacements; individual point-request/approval commands; full blocker and period-attribution administration                       |
| 6 Operational finance              | Expense/reimbursement requests, version-specific independent CEO decision, actual partial payments, unique references, remaining-approval enforcement, reconciliation, prompt receipt recording/independent verification, prepared/approved/active budget commands         | Invoice issuance and partial receipt allocation, receipt-to-journal orchestration, over-budget flag/override control, exception/correction flows and committed-budget reporting  |
| 7 Accounting/payroll               | Balanced journal preparation, independent approval, atomic posting, unique source references, locked-period denial, immutable posted journal/lines, approval invalidation on material edits, payroll draft schema with statutory execution disabled                        | Chart/fiscal period administration UI, reversal/replacement workflow, account ledger/trial balance reports, restricted payroll preparation UI                                    |
| 8 Other operations                 | Recruitment records/stage decisions with job-related evidence, sprint/release creation, shared project tasks, private document staged-upload/download code, scoped reports, durable request/task notifications, compensation proposal/HR/CEO/effective-title commands      | Complete compensation component execution, release checklists/deployment history editor, notification decisions for every workflow, server pagination/scoped aggregate endpoints |
| 9 Verification/recovery/deployment | Unit/SQL/browser checks, actual concurrency race checks, local database+fictional-file restoration, production build, Netlify config, deployment/recovery/permission/workflow docs                                                                                         | Hosted security/Auth/Storage/email tests; real encrypted offsite backup/restore rehearsal; production acceptance and explicit deployment authorization                           |

## Actual verification results

- `npm run lint`: passed, zero warnings after cleanup.
- `npm run typecheck`: passed under strict TypeScript.
- `npm test`: 17/17 passed, including known 82-point formula, missing evidence, half days, exact money, authorization, and interval rules.
- `node scripts/test-database.mjs`: 282 assertions passed, psql exit 0. Includes RLS and anonymous SELECT/direct INSERT/UPDATE/DELETE privilege checks on all 42 application tables; employee-private denial; role escalation denial; project scope; disabled claims; last-owner protection; task submission/acceptance; overlaps; leave use/reversal; self-approval denial; independent receipt verification; versioned expense approval; partial/duplicate/excess payments; balanced/unbalanced/locked journals; immutable records; known database score 98; employee response/finalization; invitation provisioning with Employee role only.
- `node scripts/test-concurrency.mjs`: passed in a separate freshly migrated database. Two simultaneous approval calls produced one approval; two competing payment calls produced one 60.00 payment.
- `node scripts/test-recovery.mjs`: passed. 42 tables restored into a separate local database; a fictional file's SHA-256 matched. Hosted private-file/Auth restoration is not verified.
- `npx playwright test`: 5/5 passed. All 14 development preview routes rendered without page errors; dialogs, read-only preview enforcement, search, list/board, finance approval/payment separation, mobile navigation, Escape dismissal, and mobile viewport width were checked.
- Desktop dashboard/My Work/HR/Finance and mobile dashboard screenshots captured under `docs/qa`; desktop and mobile images visually inspected.
- `npm run build`: passed with Next.js 16.4.0, React 19.3.0, Node 24.19.0. Development fixture route returns 404 in production.
- `npm audit --omit=dev`: zero vulnerabilities. Full development audit reports five high findings in the ESLint → glob/micromatch/braces chain; these remain unresolved. No automatic framework downgrade was applied.

Database tests use a local PostgreSQL 18 Auth/Storage schema harness, not a hosted JWT or Storage API test. Browser tests use explicitly labeled fictional, read-only fixtures; authenticated end-to-end provider journeys remain pending. Tests do not establish regulatory accounting, employment, or statutory payroll compliance.

## Migrations and generated types

Nine ordered SQL migrations cover identity, settings, operations, performance, finance, accounting, private documents, reliable notifications, protected commands, and hardening. `supabase/install.sql` is the reviewable bundle. If the first eight were already applied, apply migration `202610130009_provisioning_fix.sql` only.

`src/lib/supabase/database.types.ts` was generated from the actually migrated PostgreSQL catalog using `scripts/generate-db-types.mjs`; it is used by the SSR client and RPC routes.

## Hosted project gate

The supplied project URL/publishable key are in ignored `.env.local`. Read-only verification found Auth HTTP 200, public signup enabled, and employee REST HTTP 404 before installation. The user chose to apply the migrations and disable public signup. Completion of those actions has not yet been verified. No service-role key or database management connection was provided.

The publishable key cannot install migrations, disable provider signup, bootstrap an Auth owner, or administer invitations. See `provider-verification.md` for concrete setup steps. Do not paste management secrets into chat.

## Next action

Confirm hosted migration/signup settings; bootstrap the first real owner; verify actual login/MFA and RLS with disposable development identities. Then complete remaining workflow items above and run authenticated provider end-to-end journeys before production approval. Deployment remains unpublished.

## Internal ticketing (13 October 2026)

Implemented `/ticketing` navigation and authenticated Supabase commands for issue reporting, active employee assignment by owner/admin, status changes, requester close/reopen, comments, immutable event history, audit records and in-app notifications. Categories cover IT, hardware, software/accounts, internet, office equipment, facilities, supplies, HR and other office issues. Employees can read only their reported or assigned tickets; owners/admins can read all. Updates require the current version and lock the row. Direct mutations and anonymous reads are denied.

Migration 010 is an incremental upgrade for installed projects; the new-project installer now contains ten migrations. Local SQL tests pass 282 assertions including ticket access, history, reopening, stale versions, and forbidden assignment/resolution. Five browser tests cover the fifteen screens plus ticket search/details/read-only creation and mobile width. Lint, strict types, unit tests and production build pass. The existing finance race tests also pass with all ten migrations installed.

Ticket lists show at most 100 recently updated records; comment/event queries currently cap at 1,000 visible rows each. Database pagination, attachments and email/SLA escalation are not implemented. Hosted ticket JWT, notification delivery and authenticated browser journeys remain unverified; no hosted migration was applied by the agent.

## Branded deployment package (13 October 2026)

Applied the user's original RepairMe logo to portal navigation and authentication. Fixed short-screen navigation scrolling, mobile Finance card overflow and scrolling Finance tabs, and improved authentication description contrast. Reviewed desktop/mobile login screenshots. All 15 fixture screens pass mobile document-width checks; six browser tests, 19 unit tests, lint, strict types and the final production build pass. Local dependency installation was restored from the lockfile after a missing ESLint module; a concurrent build/browser run exhausted memory, and subsequent sequential validation passed.

`releases/RepairMe-One-deployment.zip` is a source handoff generated by `scripts/package-release.py`, with archive integrity verification and a SHA-256 manifest. It excludes `.env.local`, dependencies, compiled output, local PostgreSQL and backups. `RELEASE.md` describes Netlify setup and remaining provider verification. This is a hosted-testing candidate, not a claim that every requested feature or live authenticated journey is complete.

## Hosted testing deployment

Published 13 October 2026 on Netlify: https://extraordinary-semolina-40421d.netlify.app. Linux source build with explicit Next.js adapter passed. Public login and logo load; fixture previews are blocked; protected dashboard redirects to login and unauthenticated commands return 401. Browser reports no page errors. Supabase hosted auth URL confirmation and live account recovery/MFA tests remain pending. See `docs/hosted-deployment.json`.

## Work-log window, leader comments and any-employee leaders (15 October 2026)

Migration `202610130019_work_log_window_and_comments.sql` (apply to an installed project in the Supabase SQL Editor; the new-project installer already includes it).

- **Daily window.** Work logs can be submitted and edited only between the company work start and work end (default 09:00 to 18:00 in the company time zone, on configured working weekdays). A log must be for today. After the end time it is locked. Enforced in the database, not only on screen.
- **Editing.** The employee can edit their own log for today until the cutoff. The previous values are kept in the audit trail and the log returns to the leader as submitted.
- **Comments.** The project leader (or CEO) can comment on any log of the project; the employee can reply. Comments are immutable, still allowed after the cutoff, and notify the other person.
- **Changing the times.** The CEO sets the work start and end under Settings. The migration changes the default end from 17:00 to 18:00 and updates the existing row if it still holds 17:00.
- **Project leaders.** Any active employee can be project leader (previously managers and the CEO only). Leader powers still come only from the project's leader field.
- **Tests.** `supabase/tests/security-and-workflows.sql` now has 452 assertions. It sets every day as a working day with an all-day window so the suite does not depend on when it runs; the new assertions cover the window, edits, comments and employee leaders. Two old assertions that required leaders to be managers were changed to match the new rule.

## MFA removed, work-log dates and PDF, agent idle fix (15 October 2026)

Migration `202610130020_remove_mfa_and_idle_guard.sql` (apply after 019).

- **MFA removed.** Sign-in is email and password only. The authenticator pages, enrollment route and "remember this device" cookie are gone, and the database no longer asks for MFA. The one-active-session rule remains. Older sections of this document, `permissions.md`, `workflows.md` and `provider-verification.md` that describe MFA are historical. Anyone who enrolled an authenticator in Supabase can ignore it.
- **Work logs by date.** Work Logs has a From/To date picker (Today, Yesterday, Last 7 days, All dates). The dates are read from the database, so any day can be viewed, not only the latest 100 logs.
- **PDF export.** Work Logs and Tasks have a PDF button. Status cells use the portal colours: waiting yellow, in progress blue, approved or completed green, rejected or overdue red. Work-log PDFs include the latest leader comment. The PDF is generated in the browser by `src/lib/pdf.ts`.
- **Agent time stopping.** Time kept counting while a person was away because a changing window or memory use counted as work. Now, after 5 minutes without keyboard or mouse only sustained heavy CPU counts, and after 30 minutes nothing counts. The database enforces this for every agent version, so computers that already have the old agent are fixed without reinstalling. The on-screen work-time clock also stops after check-out. A rebuilt installer (`agent/build.bat`) carries the same rule on the computer itself.
- Verification: 455 database assertions, 39 unit tests, 29 agent tests, 15 browser tests, lint, strict types and build pass.

## Leader reopen of a locked work log (15 October 2026)

Migration `202610130021_work_log_reopen.sql`. A project leader or the CEO can reopen a day (up to 7 days back) for an employee of their project from Work Logs ("Reopen" next to anyone missing a log, or "Reopen for editing" on a log). The employee may then submit and edit that day's log for 4 hours. A reason is required, the employee is notified, and it is audited. Nobody can reopen their own log. Database tests: 465 assertions.
