import { NextResponse } from 'next/server';
import { identity } from '@/lib/supabase/identity';
import { serverClient } from '@/lib/supabase/server';
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await identity();
  if (!user || user.needsMfa) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const db = await serverClient();
  const { data } = await db.from('documents').select('path').eq('id', id).single();
  if (!data) return new NextResponse(null, { status: 404 });
  const { data: link, error } = await db.storage
    .from('private-documents')
    .createSignedUrl(data.path, 60);
  if (error) return new NextResponse(null, { status: 403 });
  return NextResponse.redirect(link.signedUrl, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
