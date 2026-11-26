import {database} from '../packages/database/index.ts'
export const schemaFingerprintSql=`with components as (
 select 'columns' component,table_name||'.'||column_name name,
 jsonb_build_array(ordinal_position,data_type,udt_schema,udt_name,is_nullable,column_default,numeric_precision,numeric_scale,is_identity,identity_generation)::text definition
 from information_schema.columns where table_schema='observabr'
 union all select 'constraints',c.relname||'.'||co.conname,replace(pg_get_constraintdef(co.oid),'REFERENCES observabr.','REFERENCES ') from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='observabr'
 union all select 'indexes',indexname,indexdef from pg_indexes where schemaname='observabr'
 union all select 'policies',tablename||'.'||policyname,jsonb_build_array(permissive,roles,cmd,qual,with_check)::text from pg_policies where schemaname='observabr'
 union all select 'rls',c.relname,c.relrowsecurity::text||':'||c.relforcerowsecurity::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='observabr' and c.relkind='r'
 union all select 'functions',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',replace(pg_get_functiondef(p.oid),chr(13),'') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='observabr' and p.prokind='f'
 union all select 'group_grants',table_name||'.'||grantee||'.'||privilege_type,is_grantable from information_schema.role_table_grants where table_schema='observabr' and grantee in ('observabr_reader','observabr_writer')
 ) select component,count(*)::int objects,md5(string_agg(name||':'||definition,E'\\n' order by name collate "C",definition collate "C")) fingerprint from components group by component order by component`
if(process.argv[1]?.endsWith('schema-fingerprint.ts')){
 const pool=database()
 try{console.log(JSON.stringify((await pool.query(schemaFingerprintSql)).rows))}finally{await pool.end()}
}
