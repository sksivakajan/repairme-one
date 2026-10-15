import { NextRequest, NextResponse } from 'next/server';
import { identity } from '@/lib/supabase/identity';
import { serverClient, isConfigured } from '@/lib/supabase/server';
export async function POST(req: NextRequest) {
  if (
    !process.env.APP_ORIGIN ||
    req.headers.get('origin') !== new URL(process.env.APP_ORIGIN).origin
  )
    return new NextResponse(null, { status: 403 });
  if (!isConfigured())
    return NextResponse.json(
      { error: 'Connect Supabase before uploading private files.' },
      { status: 503 },
    );
  const actor = await identity();
  if (!actor) return new NextResponse(null, { status: 401 });
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > 5300000)
    return NextResponse.json({ error: 'Maximum file size is 5 MB.' }, { status: 413 });
  const form = await req.formData();
  const file = form.get('file');
  const classification = String(form.get('classification') ?? 'own');
  if (
    !(file instanceof File) ||
    file.size < 1 ||
    file.size > 5242880 ||
    !['application/pdf', 'image/jpeg', 'image/png', 'text/plain'].includes(file.type)
  )
    return NextResponse.json(
      { error: 'Use PDF, PNG, JPEG, or plain text, up to 5 MB.' },
      { status: 422 },
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  const isPng = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const isJpeg = bytes[0] === 255 && bytes[1] === 216;
  if (
    (file.type === 'application/pdf' && !isPdf) ||
    (file.type === 'image/png' && !isPng) ||
    (file.type === 'image/jpeg' && !isJpeg)
  )
    return NextResponse.json(
      { error: 'File contents do not match the declared type.' },
      { status: 422 },
    );
  const db = await serverClient();
  const { data, error } = await db.rpc('prepare_document', {
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    classification,
    project_id: String(form.get('project_id') ?? '') || null,
  });
  if (
    error ||
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    typeof data.path !== 'string' ||
    typeof data.id !== 'string'
  )
    return NextResponse.json({ error: 'Document access denied.' }, { status: 403 });
  const { error: uploadError } = await db.storage
    .from('private-documents')
    .upload(data.path, bytes, { contentType: file.type, upsert: false });
  if (uploadError)
    return NextResponse.json(
      { error: 'Upload failed. The staged record is not publicly accessible.' },
      { status: 409 },
    );
  const { error: finishError } = await db.rpc('finish_document', { document_id: data.id });
  if (finishError)
    return NextResponse.json(
      { error: 'Upload is staged and requires administrator recovery.' },
      { status: 409 },
    );
  return NextResponse.json(
    { success: true },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
