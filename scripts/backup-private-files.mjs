import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, sep, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const destination = process.env.BACKUP_DIRECTORY;
if (!destination || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL)
  throw new Error(
    'Configure a restricted BACKUP_DIRECTORY and server-only provider credentials locally.',
  );
const root = resolve(destination);
mkdirSync(root, { recursive: true });
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const manifest = [];
async function walk(prefix = '') {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.storage
      .from('private-documents')
      .list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error('Storage listing failed');
    for (const object of data) {
      const path = prefix ? `${prefix}/${object.name}` : object.name;
      if (!object.id) {
        await walk(path);
        continue;
      }
      const target = resolve(root, 'files', path);
      if (!target.startsWith(resolve(root, 'files') + sep))
        throw new Error('Unsafe storage object path');
      const { data: file, error: downloadError } = await db.storage
        .from('private-documents')
        .download(path);
      if (downloadError) throw new Error('Private file download failed');
      const bytes = new Uint8Array(await file.arrayBuffer());
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
      manifest.push({
        path,
        size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
    if (data.length < 100) break;
  }
}
await walk();
const metadata = [];
for (let from = 0; ; from += 100) {
  const { data, error } = await db
    .from('documents')
    .select('*')
    .range(from, from + 99);
  if (error) throw new Error('Document metadata export failed');
  metadata.push(...data);
  if (data.length < 100) break;
}
writeFileSync(
  resolve(root, 'manifest.json'),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      bucket: 'private-documents',
      public: false,
      objects: manifest,
      documents: metadata,
    },
    null,
    2,
  ),
);
console.log(
  `Exported ${manifest.length} private objects. Encrypt and store this restricted directory offsite before considering backup complete.`,
);
