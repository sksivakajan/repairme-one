import { NextRequest, NextResponse } from 'next/server';
import { serverClient, isConfigured } from '@/lib/supabase/server';
export async function POST(req: NextRequest) {
  if (
    !process.env.APP_ORIGIN ||
    req.headers.get('origin') !== new URL(process.env.APP_ORIGIN).origin
  )
    return new NextResponse(null, { status: 403 });
  if (isConfigured()) await (await serverClient()).auth.signOut({ scope: 'local' });
  return NextResponse.redirect(new URL('/login', process.env.APP_ORIGIN), 303);
}
