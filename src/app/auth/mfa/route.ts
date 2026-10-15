import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { z } from 'zod';
export async function POST(req: NextRequest) {
  if (
    !process.env.APP_ORIGIN ||
    req.headers.get('origin') !== new URL(process.env.APP_ORIGIN).origin
  )
    return new NextResponse(null, { status: 403 });
  const db = await serverClient();
  const { data } = await db.auth.getClaims();
  if (!data?.claims.sub) return new NextResponse(null, { status: 401 });
  const parsed = z
    .object({
      action: z.enum(['prepare', 'verify']),
      factorId: z.string().optional(),
      code: z
        .string()
        .regex(/^\d{6}$/)
        .optional(),
    })
    .safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid authenticator request' }, { status: 422 });
  if (parsed.data.action === 'prepare') {
    const { data: factors } = await db.auth.mfa.listFactors();
    const existing = factors?.totp.find((f) => f.status === 'verified');
    if (existing)
      return NextResponse.json(
        { id: existing.id },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    for (const factor of factors?.all ?? [])
      if (factor.factor_type === 'totp' && factor.status === 'unverified')
        await db.auth.mfa.unenroll({ factorId: factor.id });
    const { data: enrollment, error } = await db.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'RepairMe One',
    });
    if (error)
      return NextResponse.json({ error: 'Unable to prepare authenticator' }, { status: 400 });
    return NextResponse.json(
      { id: enrollment.id, secret: enrollment.totp.secret, qrCode: enrollment.totp.qr_code },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  if (!parsed.data.factorId || !parsed.data.code)
    return NextResponse.json({ error: 'Code required' }, { status: 422 });
  const { error } = await db.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  return error
    ? NextResponse.json({ error: 'Unable to verify code' }, { status: 400 })
    : NextResponse.json({ success: true });
}
