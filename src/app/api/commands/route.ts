import { NextRequest, NextResponse } from 'next/server';
import { commandSchema, expenseSchema } from '@/lib/validation';
import { identity } from '@/lib/supabase/identity';
import { serverClient, isConfigured } from '@/lib/supabase/server';
export async function POST(request: NextRequest) {
  if (
    !process.env.APP_ORIGIN ||
    request.headers.get('origin') !== new URL(process.env.APP_ORIGIN).origin
  )
    return NextResponse.json({ error: 'Request origin denied' }, { status: 403 });
  if (!isConfigured())
    return NextResponse.json(
      { error: 'Connect Supabase to save changes. The fixture preview is read only.' },
      { status: 503 },
    );
  const user = await identity();
  if (!user || user.needsMfa)
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = commandSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  const { action, id, version, payload } = parsed.data;
  if (action === 'submit_expense') {
    const valid = expenseSchema.safeParse(payload);
    if (!valid.success)
      return NextResponse.json({ error: valid.error.issues[0].message }, { status: 422 });
  }
  const db = await serverClient();
  const { data, error } = await db.rpc('command', {
    action,
    record_id: id ?? null,
    expected_version: version ?? null,
    payload,
  });
  if (error) {
    const safe = error.message.replace(/\n/g, ' ').slice(0, 180);
    return NextResponse.json(
      { error: safe },
      { status: 409, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}
