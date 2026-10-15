import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return response;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  const sessionExempt = ['/auth/', '/login', '/recovery'].some((p) => path.startsWith(p));
  if (data?.claims?.sub && !sessionExempt) {
    // Another sign-in replaced this session: clear the cookies and send the user to sign in again.
    const { data: current } = await supabase.rpc('session_is_current');
    if (current === false) {
      await supabase.auth.signOut({ scope: 'local' });
      const ended = path.startsWith('/api/')
        ? NextResponse.json(
            { error: 'You were signed out because this account signed in on another device.' },
            { status: 401 },
          )
        : NextResponse.redirect(new URL('/login?reason=another-device', request.url));
      response.cookies.getAll().forEach((c) => ended.cookies.set(c));
      ended.headers.set('Cache-Control', 'private, no-store');
      return ended;
    }
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
