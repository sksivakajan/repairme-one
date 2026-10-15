import { spawnSync } from 'node:child_process';
const result = spawnSync(
  'psql',
  ['-X', '-v', 'ON_ERROR_STOP=1', '-f', 'supabase/tests/security-and-workflows.sql'],
  { encoding: 'utf8' },
);
const output = result.stdout + '\n' + result.stderr;
const passes = output.match(/PASS:/g)?.length ?? 0;
console.log(
  output
    .split('\n')
    .filter((s) => /PASS:|ERROR:|DETAIL:|CONTEXT:/.test(s))
    .join('\n'),
);
console.log(`${passes} database assertions passed; psql exit ${result.status}.`);
process.exit(result.status ?? 1);
