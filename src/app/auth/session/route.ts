import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverClient, isConfigured } from '@/lib/supabase/server';
const schema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('login'), email: z.email(), password: z.string().min(8).max(128) }),
  z.object({ mode: z.literal('recovery'), email: z.email() }),
  z.object({ mode: z.literal('password'), password: z.string().min(12).max(128) }),
]);
export async function POST(req: NextRequest) {
  if (
    !process.env.APP_ORIGIN ||
    req.headers.get('origin') !== new URL(process.env.APP_ORIGIN).origin
  )
    return NextResponse.json({ error: 'Request origin denied' }, { status: 403 });
  if (!isConfigured())
    return NextResponse.json({ error: 'Workspace is not configured.' }, { status: 503 });
  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json({ error: 'Check your email and password.' }, { status: 422 });
  const db = await serverClient();
  const data = parsed.data;
  if (data.mode === 'recovery') {
    const { error } = await db.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${process.env.APP_ORIGIN}/auth/callback?next=/account`,
    });
    if (error) {
      const limited = error.status === 429 || error.code === 'over_email_send_rate_limit';
      console.error('Password recovery provider failure', {
        code: error.code,
        status: error.status,
      });
      return NextResponse.json(
        {
          error: limited
            ? 'Recovery email limit reached. Please wait before trying again or contact your administrator.'
            : 'Recovery email could not be sent. Contact your administrator to check the email delivery settings.',
        },
        { status: limited ? 429 : 503, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }
    return NextResponse.json(
      {
        message:
          'If this account is eligible, a recovery email will be sent. Check your spam folder too.',
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  const { error } =
    data.mode === 'login'
      ? await db.auth.signInWithPassword({ email: data.email, password: data.password })
      : await db.auth.updateUser({ password: data.password });
  if (error)
    return NextResponse.json(
      { error: 'Unable to authenticate. Check your details or try again later.' },
      { status: 401 },
    );
  if (data.mode === 'login') {
    // This sign-in becomes the account's only active session; any other device is signed out.
    const { error: claimError } = await db.rpc('claim_session', { trusted_hash: null });
    if (claimError) {
      await db.auth.signOut({ scope: 'local' });
      return NextResponse.json(
        { error: 'Unable to start your session. Try again.' },
        { status: 503 },
      );
    }
  }
  return NextResponse.json(
    { redirect: '/dashboard' },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
