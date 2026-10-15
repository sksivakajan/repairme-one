import { serverClient } from './server';
import type { Role } from '@/lib/permissions';
export async function identity() {
  const db = await serverClient();
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const { data: employee } = await db
    .from('employees')
    .select('id,first_name,last_name,job_title,status')
    .eq('id', data.claims.sub)
    .single();
  if (!employee || !['active', 'onboarding'].includes(employee.status)) return null;
  const { data: assigned } = await db.from('user_roles').select('role').eq('user_id', employee.id);
  const userRoles = (assigned ?? []).map((r) => r.role as Role);
  if (userRoles.some((r) => ['ceo', 'admin', 'hr', 'finance', 'manager'].includes(r))) {
    const { data: assurance } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel !== 'aal2')
      return { ...employee, roles: userRoles, needsMfa: true };
  }
  return { ...employee, roles: userRoles, needsMfa: false };
}
