import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next');
  if (code) {
    const db = await serverClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      await db.rpc('claim_session', { trusted_hash: null });
      return NextResponse.redirect(
        new URL(
          next === '/account' ? '/account' : '/dashboard',
          process.env.APP_ORIGIN ?? req.nextUrl.origin,
        ),
      );
    }
  }
  return NextResponse.redirect(
    new URL('/recovery?error=invalid_link', process.env.APP_ORIGIN ?? req.nextUrl.origin),
  );
}
