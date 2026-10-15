import { redirect } from 'next/navigation';
import { identity } from '@/lib/supabase/identity';
import { isConfigured } from '@/lib/supabase/server';
import { MfaForm } from '@/components/mfa-form';
export const dynamic = 'force-dynamic';
export default async function Mfa({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!isConfigured()) redirect('/login');
  const user = await identity();
  if (!user) redirect('/login');
  const { next } = await searchParams;
  return <MfaForm next={next === '/account' ? '/account' : '/dashboard'} />;
}
