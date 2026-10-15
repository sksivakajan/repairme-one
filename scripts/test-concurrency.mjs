import { execFileSync, spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
if (!['127.0.0.1', 'localhost'].includes(process.env.PGHOST ?? ''))
  throw new Error('Local test database required');
const database = 'repairme_race_' + Date.now();
execFileSync('createdb', [database]);
const env = { ...process.env, PGDATABASE: database };
const run = (args) =>
  execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', ...args], { encoding: 'utf8', env });
// Roles already exist in this local cluster. Bootstrap the schemas only.
const bootstrap = run([
  '-c',
  "create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';create function auth.jwt() returns jsonb language sql stable as 'select coalesce(nullif(current_setting(''request.jwt.claims'',true),''''),''{}'')::jsonb';grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;",
]);
void bootstrap;
for (const file of readdirSync('supabase/migrations')
  .filter((f) => f.endsWith('.sql'))
  .sort())
  run(['-f', 'supabase/migrations/' + file]);
run([
  '-c',
  "insert into auth.users values('00000000-0000-0000-0000-000000000001','owner@example.test'),('00000000-0000-0000-0000-000000000002','finance@example.test');insert into public.employees(id,employee_number,first_name,last_name,work_email,status)select id,email,'Test','Race',email,'active' from auth.users;insert into public.user_roles values('00000000-0000-0000-0000-000000000001','ceo'),('00000000-0000-0000-0000-000000000002','finance');insert into public.expenses(id,submitted_by,payee,purpose,category,amount,evidence)values('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Test','Concurrency test','Test',100,'Fixture evidence');",
]);
const attempt = (user, statement) =>
  new Promise((resolve) => {
    const proc = spawn(
      'psql',
      [
        '-X',
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        `set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);select set_config('request.jwt.claims','{"aal":"aal2"}',false);${statement}`,
      ],
      { env, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    proc.stdout.on('data', (b) => (output += b));
    proc.stderr.on('data', (b) => (output += b));
    proc.on('close', (code) => resolve({ code, output }));
  });
const approve =
  "select public.command('approve_expense','30000000-0000-0000-0000-000000000001',1,'{\"reason\":\"Independent concurrent review\"}');";
const approvals = await Promise.all([
  attempt('00000000-0000-0000-0000-000000000001', approve),
  attempt('00000000-0000-0000-0000-000000000001', approve),
]);
if (approvals.filter((r) => r.code === 0).length !== 1)
  throw new Error('Expected exactly one successful approval: ' + JSON.stringify(approvals));
const pay =
  'select public.command(\'record_payment\',\'30000000-0000-0000-0000-000000000001\',2,\'{"amount":"60","reference":"RACE-PAY","evidence":"Fixture receipt"}\');';
const payments = await Promise.all([
  attempt('00000000-0000-0000-0000-000000000002', pay),
  attempt('00000000-0000-0000-0000-000000000002', pay),
]);
if (payments.filter((r) => r.code === 0).length !== 1)
  throw new Error('Expected exactly one payment: ' + JSON.stringify(payments));
const totals = run([
  '-A',
  '-t',
  '-c',
  "select (select count(*) from public.finance_approvals)||':'||(select count(*) from public.payments)||':'||(select sum(amount) from public.payments)",
]).trim();
if (totals !== '1:1:60.00') throw new Error('Duplicate race result: ' + totals);
console.log(
  `Concurrency passed in ${database}: two approvals -> one approval; two payments -> one 60.00 payment.`,
);
