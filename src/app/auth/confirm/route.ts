import type { EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type');
  const origin = process.env.APP_ORIGIN ?? req.nextUrl.origin;
  if (hash && type && ['invite', 'recovery', 'email_change'].includes(type)) {
    const db = await serverClient();
    const { error } = await db.auth.verifyOtp({ token_hash: hash, type: type as EmailOtpType });
    if (!error) {
      await db.rpc('claim_session', { trusted_hash: null });
      return NextResponse.redirect(new URL('/account', origin));
    }
  }
  return NextResponse.redirect(new URL('/recovery?error=invalid_link', origin));
}
