import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { anonClient } from '@/lib/supabase/anon';
import { isConfigured } from '@/lib/supabase/server';
const number = (max: number) => z.number().finite().min(0).max(max);
const schema = z.object({
  state: z.enum(['active', 'idle', 'locked']),
  active_seconds: number(300),
  cpu_percent: number(100).default(0),
  ram_percent: number(100).default(0),
  ram_used_mb: number(10_000_000).default(0),
  ram_total_mb: number(10_000_000).default(0),
  cpu_count: number(4096).default(0),
  process_count: number(1_000_000).default(0),
  foreground_app: z.string().max(80).default(''),
  input_idle_seconds: number(31_536_000).default(0),
  agent_version: z.string().max(20).default(''),
  top_apps: z
    .array(
      z.object({
        name: z.string().max(60),
        cpu: number(100_000),
        ram_mb: number(10_000_000),
      }),
    )
    .max(8)
    .default([]),
});
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: NextRequest) {
  if (!isConfigured())
    return NextResponse.json({ error: 'Workspace is not configured.' }, { status: 503, headers });
  const token = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) return NextResponse.json({ error: 'Agent token required' }, { status: 401, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid report' }, { status: 422, headers });
  const { data, error } = await anonClient().rpc('agent_heartbeat', {
    token,
    payload: parsed.data,
  });
  if (error) return NextResponse.json({ error: 'Report failed' }, { status: 502, headers });
  const result = data as { ok: boolean; reason?: string };
  // A revoked or unknown token must stop the agent from reporting.
  if (!result.ok) return NextResponse.json(result, { status: 401, headers });
  return NextResponse.json(result, { headers });
}
