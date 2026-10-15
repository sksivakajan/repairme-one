import { serverClient } from './server';
import type { Role } from '@/lib/permissions';
export async function identity() {
  const db = await serverClient();
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const { data: current } = await db.rpc('session_is_current');
  if (current === false) return null;
  const { data: employee } = await db
    .from('employees')
    .select('id,first_name,last_name,job_title,status')
    .eq('id', data.claims.sub)
    .single();
  if (!employee || !['active', 'onboarding'].includes(employee.status)) return null;
  const { data: assigned } = await db.from('user_roles').select('role').eq('user_id', employee.id);
  const userRoles = (assigned ?? []).map((r) => r.role as Role);
  return { ...employee, roles: userRoles };
}
