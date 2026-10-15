import { NextResponse } from 'next/server';
import { identity } from '@/lib/supabase/identity';
import { isConfigured, serverClient } from '@/lib/supabase/server';
const headers = { 'Cache-Control': 'private, no-store' };
// Coffee-break state for the signed-in employee: continuous work time, whether a break is offered or running.
export async function GET() {
  if (!isConfigured())
    return NextResponse.json({ error: 'Not configured' }, { status: 503, headers });
  const user = await identity();
  if (!user)
    return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers });
  const { data, error } = await (await serverClient()).rpc('work_status');
  if (error) return NextResponse.json({ error: 'Status unavailable' }, { status: 502, headers });
  return NextResponse.json(data, { headers });
}
