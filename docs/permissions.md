# Permission matrix

Multiple roles are supported. Developer is a job function, not a security role. All business privileges come from `user_roles`, protected by database grants and transactional RPCs; editable Auth metadata is never consulted.

| Data / action               | Employee                 | Project manager               | HR                    | Finance                  | CEO                    | Admin alone              |
| --------------------------- | ------------------------ | ----------------------------- | --------------------- | ------------------------ | ---------------------- | ------------------------ |
| Directory                   | Read                     | Read                          | Read                  | Read                     | Read                   | Read                     |
| Employee-private data       | Own                      | No                            | Read                  | No                       | Read                   | No                       |
| Compensation proposals      | No                       | Propose for reports           | Review/administer     | No                       | Decide                 | No                       |
| Projects/tasks              | Membership               | Assigned projects             | Membership            | Membership               | Company                | Membership               |
| Submit task deliverable     | Assigned task            | Assigned task                 | Assigned task         | Assigned task            | Assigned task          | Assigned task            |
| Accept task                 | No                       | Assigned project, independent | No                    | No                       | Independent            | No                       |
| Work logs                   | Own                      | Assigned-project review       | Own                   | Own                      | Authorized review      | Own                      |
| Attendance                  | Own                      | Direct reports                | Administer            | Own                      | Company                | Own                      |
| Leave                       | Own                      | Direct reports                | Administer            | Own                      | Fallback reviewer      | Own                      |
| Finance records             | Own requests             | Own requests                  | Own requests          | Read/record execution    | Read/approve           | Own requests only        |
| Outgoing approval           | No                       | No                            | No                    | No                       | Independent            | No                       |
| Record actual payment       | No                       | No                            | No                    | Current approved request | Only with Finance role | No                       |
| Journals                    | No                       | No                            | No                    | Prepare/post             | Approve                | No                       |
| Payroll drafts              | No                       | No                            | Restricted            | No                       | Restricted             | No                       |
| Recruitment                 | No                       | No                            | Administer            | No                       | Read/administer        | No                       |
| Account lifecycle           | No                       | No                            | Offboarding checklist | No                       | Administer             | Administer               |
| Assign HR/Finance/CEO roles | No                       | No                            | No                    | No                       | Yes                    | No                       |
| Technical settings          | No                       | No                            | No                    | No                       | Yes                    | Yes                      |
| Working-policy changes      | No                       | No                            | No                    | No                       | CEO authorized         | No                       |
| Private files               | Own / authorized project | Authorized project            | HR classification     | Finance classification   | Authorized classes     | Own / authorized project |

System administrators do not inherit Finance or HR privileges. The last active CEO cannot be disabled or removed. Independent review excludes the request submitter/beneficiary. An owner with no independent approver cannot have their own claim executed.

RLS SELECT is separately tested. INSERT, UPDATE, and DELETE are denied by privilege and absence of write policies; mutations must pass RPC authorization. New tables must explicitly enable RLS, revoke write grants, and add tests before use.

Privileged server access requires TOTP AAL2. Business-role helper checks also require AAL2. Directory/self-scope reads remain available at AAL1 to determine whether MFA is required. Full hosted JWT/MFA enforcement remains a provider integration verification item.
