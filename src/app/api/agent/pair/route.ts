import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { anonClient } from '@/lib/supabase/anon';
import { isConfigured } from '@/lib/supabase/server';
const schema = z.object({
  code: z.string().min(6).max(24),
  device_name: z.string().min(1).max(80),
  os: z.string().max(80).default(''),
  agent_version: z.string().max(20).default(''),
});
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: NextRequest) {
  if (!isConfigured())
    return NextResponse.json({ error: 'Workspace is not configured.' }, { status: 503, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Check the code and try again.' }, { status: 422, headers });
  const { data, error } = await anonClient().rpc('agent_pair', {
    code: parsed.data.code,
    device_name: parsed.data.device_name,
    os: parsed.data.os,
    agent_version: parsed.data.agent_version,
  });
  if (error)
    return NextResponse.json(
      { error: 'Unable to connect this computer.' },
      { status: 502, headers },
    );
  const result = data as {
    ok: boolean;
    token?: string;
    employee?: string;
    user_id?: string;
    error?: string;
  };
  if (!result.ok)
    return NextResponse.json(
      { error: result.error ?? 'Code is not valid.' },
      { status: 400, headers },
    );
  return NextResponse.json(
    { token: result.token, employee: result.employee, user_id: result.user_id },
    { headers },
  );
}
