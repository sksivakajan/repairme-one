// Fictional local recovery verification. Never run against a production database.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
if (!['127.0.0.1', 'localhost'].includes(process.env.PGHOST ?? ''))
  throw new Error('Local test database required');
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' });
const source = process.env.PGDATABASE ?? 'postgres';
const target = 'repairme_restore_' + Date.now();
mkdirSync('backups/recovery-files', { recursive: true });
mkdirSync('backups/restored-files', { recursive: true });
run('psql', [
  '-X',
  '-v',
  'ON_ERROR_STOP=1',
  '-c',
  "insert into public.holidays(day,name) values('2099-01-01','Fictional recovery fixture') on conflict(day) do nothing",
]);
writeFileSync(
  'backups/recovery-files/fixture.txt',
  'RepairMe One fictional private-file recovery fixture. No employee data.\n',
);
const digest = (b) => createHash('sha256').update(b).digest('hex');
const before = digest(readFileSync('backups/recovery-files/fixture.txt'));
run('pg_dump', ['-Fc', '--no-owner', '--no-acl', '-f', 'backups/local-test.dump', source]);
run('createdb', [target]);
run('pg_restore', [
  '--exit-on-error',
  '--no-owner',
  '--no-acl',
  '-d',
  target,
  'backups/local-test.dump',
]);
const marker = run('psql', [
  '-X',
  '-A',
  '-t',
  '-d',
  target,
  '-c',
  "select count(*) from public.holidays where name='Fictional recovery fixture'",
]).trim();
if (marker !== '1') throw new Error('Restored database marker mismatch');
const count = run('psql', [
  '-X',
  '-A',
  '-t',
  '-d',
  target,
  '-c',
  "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
]).trim();
copyFileSync('backups/recovery-files/fixture.txt', 'backups/restored-files/fixture.txt');
if (digest(readFileSync('backups/restored-files/fixture.txt')) !== before)
  throw new Error('File digest mismatch');
run('psql', [
  '-X',
  '-v',
  'ON_ERROR_STOP=1',
  '-c',
  "delete from public.holidays where day='2099-01-01' and name='Fictional recovery fixture'",
]);
writeFileSync(
  'docs/recovery-test-result.json',
  JSON.stringify(
    {
      scope:
        'Local PostgreSQL schema and fictional file; hosted Supabase Auth and Storage not verified',
      sourceDatabase: source,
      restoredDatabase: target,
      tables: Number(count),
      databaseMarker: 'verified',
      fileSha256: before,
      fileDigest: 'matched',
      testedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(
  `Recovery passed: ${count} tables restored into ${target}; fictional file SHA-256 matched. Hosted storage recovery remains unverified.`,
);
