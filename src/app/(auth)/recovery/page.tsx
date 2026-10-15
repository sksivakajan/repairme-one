import { AuthForm } from '@/components/auth-form';
import { isConfigured } from '@/lib/supabase/server';
export default async function Recovery({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthForm
      mode="recovery"
      configured={isConfigured()}
      initialStatus={
        error === 'invalid_link'
          ? 'This recovery link is invalid, expired, or already used. Request a new link and open it in the same browser.'
          : undefined
      }
    />
  );
}
