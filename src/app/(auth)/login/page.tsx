import { AuthForm } from '@/components/auth-form';
import { isConfigured } from '@/lib/supabase/server';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <AuthForm
      mode="login"
      configured={isConfigured()}
      initialStatus={
        reason === 'another-device'
          ? 'You were signed out because this account signed in on another device. Only one device can be signed in at a time.'
          : ''
      }
    />
  );
}
