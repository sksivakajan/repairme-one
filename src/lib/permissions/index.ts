export const roles = ['ceo', 'admin', 'hr', 'finance', 'manager', 'employee'] as const;
export type Role = (typeof roles)[number];
export const sections = [
  'dashboard',
  'my-work',
  'projects',
  'tasks',
  'ticketing',
  'work-logs',
  'attendance',
  'employees',
  'hr',
  'finance',
  'developer-workspace',
  'performance',
  'documents',
  'reports',
  'settings',
] as const;
export type Section = (typeof sections)[number];
export function canAccess(userRoles: Role[], section: string) {
  const restricted: Record<string, Role[]> = {
    hr: ['hr', 'ceo'],
    finance: ['finance', 'ceo'],
    reports: ['ceo', 'finance', 'hr', 'manager'],
    settings: ['ceo', 'admin'],
  };
  return (
    sections.includes(section as Section) &&
    (!restricted[section] || restricted[section].some((r) => userRoles.includes(r)))
  );
}
export function canApprove(actor: string, submitter: string, authorized: boolean) {
  return actor !== submitter && authorized;
}
