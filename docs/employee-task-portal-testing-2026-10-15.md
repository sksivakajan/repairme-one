# Employee Task Portal testing

Date: 15 October 2026 (Asia/Colombo).

Status: Initial local automated testing completed; manual login and MFA testing reported by the user. Comprehensive portal testing remains in progress. Automated results below apply to the current workspace; the environment for the manual results was not specified.

## Manual functional testing — user-reported results

The user reported the following observations on 15 October 2026. These results were not independently reproduced by the agent.

| Check | Reported result |
| --- | --- |
| Login | Successful |
| MFA verification | Successful |
| Dashboard refresh | Works correctly |
| Same-tab navigation | Works correctly |
| New-tab access | Requires repeated authentication; investigation pending |

Open finding AUTH-001: New-tab access prompts for authentication again after successful login and MFA. Browser/version, account role, exact URL/origin, session timing and whether the prompt repeats password login, MFA or both have not been recorded. Reproduce in a second tab of the same browser profile and origin, then inspect session cookie availability and MFA state. Expected cross-tab behavior must be checked against the intended session policy before classifying this as a confirmed defect. No root cause or fix is established.

## Executed checks

| Check | Result | Scope |
| --- | --- | --- |
| Unit tests (`npm test`) | 25 passed across 4 files | Workflow rules, permissions, performance calculations, recovery and MFA helpers |
| TypeScript (`npm run typecheck`) | Passed | Static type checking |
| ESLint (`npm run lint`) | Passed on rerun | Initial attempt encountered a disappearing `test-results` directory during browser startup |
| Existing browser coverage | 6 tests passed | Login branding, 15 preview routes, desktop/mobile layouts, navigation, task list view, search, dialogs, ticket detail/filtering and read-only submission |
| Added browser coverage | 3 tests passed | Signed-out dashboard/My Work/tasks/ticketing redirects, required login fields, password masking, recovery navigation, cross-origin session/command denial |

Final combined verification: `npx playwright test --workers=1 --output=test-results-verification` completed with **9 passed (21.8s)** and exit code 0.

The new regression checks are in `tests/e2e/auth-boundaries.spec.ts`. Browser testing uses Chromium and the local Next.js development server. Preview data is fictional and read only. No successful authenticated login, email delivery or persisted business mutation is established by these tests. No accounts were provisioned and `supabase/provision-finance-hr.sql` was not executed.

## Observations and limitations

- React logged hydration attribute warnings involving `style="caret-color:transparent"` on search fields during screenshot coverage. Screenshot caret handling is a possible cause; this is an inference, and needs isolation before treating console output as clean. Existing route tests capture uncaught page errors, not every console warning.
- The first browser invocation lingered after test assertions while managing the development server. A separate single-worker verification reuses the server; runner shutdown should be checked separately in CI.
- The lint directory error cleared on a subsequent run. Consider ignoring generated browser output if it recurs.
- Existing implementation notes contain historical counts and mixed deployment statements. This report distinguishes agent-executed automated checks from user-reported manual results.
- No production build, database SQL suite, hosted Auth/Storage verification, cross-browser test or real-user acceptance test was performed by the agent in this session.

## Next functional test cases

Use dedicated test identities and records in a development environment. Record the account role, expected result, actual result, evidence and any defect for each case.

| Priority | Journey | Acceptance criteria |
| --- | --- | --- |
| High | Login and sessions | Valid invited account reaches its workspace; incorrect credentials are rejected; logout blocks protected pages; suspended/offboarded accounts are denied; expired sessions recover safely |
| High | Cross-tab session persistence (AUTH-001) | Reproduce the repeated authentication prompt; compare refresh, same-tab navigation and a new tab in the same profile/origin; verify session and MFA behavior against the intended policy |
| High | Role access | Employee, administrator, finance and HR see only authorized sections and records; UI and direct API access agree; verify both provisioned multi-role accounts |
| High | Task assignment | Authorized manager creates and assigns work; assignee sees it; unauthorized users cannot edit it; changes persist after reload |
| High | Task lifecycle | Start, submit evidence, reject and independently accept; verify required evidence, self-approval denial, history and stale-version handling |
| High | Ticket lifecycle | Report, assign, comment, change status, resolve, close and reopen; verify requester/assignee visibility, administrator permissions and immutable event history |
| High | Recovery and MFA | Recovery email arrives, link works once, password updates, old credentials fail, and MFA challenge/enrollment operate with actual provider sessions |
| Medium | Concurrent changes | Two sessions editing the same task or ticket receive a controlled conflict without losing history |
| Medium | Notifications | Assignment and workflow notifications reach the correct employee and link to an authorized record |
| Medium | Validation and failures | Empty/invalid inputs, provider failure and interrupted connections produce clear errors without duplicate records |
| Medium | Accessibility and browsers | Keyboard focus, dialog controls, mobile navigation and layouts work in Chromium, Firefox and WebKit |

Full functional sign-off remains pending until these connected journeys have recorded results.
