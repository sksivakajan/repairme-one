import { redirect } from 'next/navigation';
import { identity } from '@/lib/supabase/identity';
import { AuthForm } from '@/components/auth-form';
import { isConfigured } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export default async function Account() {
  if (!isConfigured()) return <AuthForm mode="password" configured={false} />;
  const user = await identity();
  if (!user) redirect('/recovery?error=invalid_link');
  return <AuthForm mode="password" configured />;
}
