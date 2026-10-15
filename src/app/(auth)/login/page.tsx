import { AuthForm } from '@/components/auth-form';
import { isConfigured } from '@/lib/supabase/server';
export default function Login() {
  return <AuthForm mode="login" configured={isConfigured()} />;
}
