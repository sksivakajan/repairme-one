import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const files = readdirSync('supabase/migrations')
  .filter((f) => f.endsWith('.sql'))
  .sort();
writeFileSync(
  'supabase/install.sql',
  '-- RepairMe One: reviewed migration bundle. Apply once to a NEW development project.\n-- No users, passwords, employee fixtures, or paid integrations are included.\n\n' +
    files
      .map((f) => `-- ===== ${f} =====\n` + readFileSync('supabase/migrations/' + f, 'utf8'))
      .join('\n\n'),
);
console.log(`Bundled ${files.length} migrations into supabase/install.sql`);
