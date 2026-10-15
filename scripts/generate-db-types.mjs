// Generates structural Supabase types from the actually migrated PostgreSQL catalog.
// Supply connection details through standard PGHOST/PGPORT/PGUSER/PGDATABASE variables.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const query = `select coalesce(json_agg(row_to_json(c)),'[]') from (select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position)c`;
const cols = JSON.parse(
  execFileSync('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], {
    encoding: 'utf8',
  }),
);
const tables = new Map();
for (const c of cols) {
  if (!tables.has(c.table_name)) tables.set(c.table_name, []);
  tables.get(c.table_name).push(c);
}
function type(c) {
  if (c.udt_name === 'app_role') return "Database['public']['Enums']['app_role']";
  if (c.data_type === 'ARRAY') return c.udt_name === '_int4' ? 'number[]' : 'string[]';
  if (c.data_type === 'boolean') return 'boolean';
  if (
    ['integer', 'bigint', 'numeric', 'smallint', 'real', 'double precision'].includes(c.data_type)
  )
    return 'number';
  if (['json', 'jsonb'].includes(c.data_type)) return 'Json';
  return 'string';
}
let out =
  '// GENERATED from migrated PostgreSQL catalog by scripts/generate-db-types.mjs. Do not edit.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = { public: { Tables: {\n';
for (const [name, columns] of tables) {
  out += `  ${name}: {\n`;
  for (const shape of ['Row', 'Insert', 'Update']) {
    out += `    ${shape}: {\n`;
    for (const c of columns)
      out += `      ${c.column_name}${shape === 'Update' || (shape === 'Insert' && (c.column_default || c.is_nullable === 'YES')) ? '?' : ''}: ${type(c)}${c.is_nullable === 'YES' ? ' | null' : ''};\n`;
    out += '    };\n';
  }
  out += '    Relationships: [];\n  };\n';
}
const functionQuery = `select json_agg(json_build_object('name',p.proname,'names',p.proargnames,'types',array(select format_type(t,null) from unnest(p.proargtypes::oid[])t),'defaults',p.pronargdefaults,'returns',format_type(p.prorettype,null))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('command','work_status','leader_candidates','agent_pair','agent_heartbeat','claim_session','trust_this_device','revoke_trusted_devices','session_is_current','mfa_satisfied','provision_employee','prepare_document','finish_document')`;
const functions = JSON.parse(
  execFileSync('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', functionQuery], {
    encoding: 'utf8',
  }),
);
const rpcType = (t) =>
  t === 'record'
    ? '{ id: string }[]'
    : ['json', 'jsonb'].includes(t)
      ? 'Json'
      : t === 'boolean'
        ? 'boolean'
        : ['integer', 'bigint', 'numeric'].includes(t)
          ? 'number'
          : t === 'void'
            ? 'undefined'
            : 'string';
out += '}; Views: { [_ in never]: never }; Functions: {\n';
for (const f of functions) {
  const names = f.names ?? [];
  const args = names
    .map((name, i) => {
      const optional = i >= names.length - f.defaults;
      return `${name}${optional ? '?' : ''}: ${rpcType(f.types[i])}${optional ? ' | null' : ''};`;
    })
    .join('');
  const argType = names.length ? `{${args} }` : 'Record<PropertyKey, never>';
  // A set-returning function with one output column reports a scalar type; its rows are { id } objects.
  const returns = f.name === 'leader_candidates' ? '{ id: string }[]' : rpcType(f.returns);
  out += `${f.name}: { Args: ${argType}; Returns: ${returns} };\n`;
}
out +=
  "}; Enums: { app_role: 'ceo' | 'admin' | 'hr' | 'finance' | 'manager' | 'employee' }; CompositeTypes: { [_ in never]: never } } };\n";
writeFileSync('src/lib/supabase/database.types.ts', out);
console.log(`Generated types for ${tables.size} migrated tables.`);
