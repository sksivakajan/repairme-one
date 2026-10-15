import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { identity } from '@/lib/supabase/identity';
import { serverClient, isConfigured } from '@/lib/supabase/server';
const schema = z.object({
  email: z.email(),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  employee_number: z.string().min(2).max(30),
  department: z.string().min(2).max(100),
  job_title: z.string().min(2).max(100),
});
export async function POST(req: NextRequest) {
  if (
    !process.env.APP_ORIGIN ||
    req.headers.get('origin') !== new URL(process.env.APP_ORIGIN).origin
  )
    return new NextResponse(null, { status: 403 });
  if (!isConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json(
      { error: 'Invitation service has not been configured.' },
      { status: 503 },
    );
  const actor = await identity();
  if (!actor || !actor.roles.some((r) => r === 'ceo' || r === 'admin'))
    return new NextResponse(null, { status: 403 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: 'Check all employee details.' }, { status: 422 });
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${process.env.APP_ORIGIN}/auth/callback`,
  });
  if (error || !data.user)
    return NextResponse.json(
      { error: 'Invitation could not be completed. Check the provider delivery configuration.' },
      { status: 409 },
    );
  const db = await serverClient();
  const { email, ...details } = parsed.data;
  const { error: provisionError } = await db.rpc('provision_employee', {
    user_id: data.user.id,
    email,
    ...details,
  });
  if (provisionError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json(
      {
        error:
          'Employee record could not be provisioned. Check for duplicate employee numbers or emails.',
      },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { success: true },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
