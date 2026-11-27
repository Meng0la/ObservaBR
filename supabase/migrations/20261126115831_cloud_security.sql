begin;
create schema if not exists extensions;
grant usage on schema extensions to observabr_reader,observabr_writer;
do $$ declare extension_name text; begin
  for extension_name in
    select e.extname from pg_extension e join pg_namespace n on n.oid=e.extnamespace
    where e.extname in ('pg_trgm','unaccent') and n.nspname<>'extensions'
  loop
    execute format('alter extension %I set schema extensions',extension_name);
  end loop;
end $$;
do $$ declare role_name text; begin
  for role_name in select rolname from pg_roles where rolname in ('anon','authenticated') loop
    execute format('revoke all on schema observabr from %I',role_name);
  end loop;
end $$;
-- Supabase's optional automatic-RLS event trigger must not be exposed as an RPC.
do $$ begin
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='rls_auto_enable' and p.pronargs=0
    and p.prorettype='event_trigger'::regtype) then
    revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
  end if;
end $$;
commit;
