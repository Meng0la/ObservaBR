begin;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create schema observabr;
revoke all on schema observabr from public;
do $$ begin
  if not exists (select from pg_roles where rolname='observabr_reader') then create role observabr_reader nologin; end if;
  if not exists (select from pg_roles where rolname='observabr_writer') then create role observabr_writer nologin; end if;
end $$;
grant usage on schema observabr to observabr_reader,observabr_writer;
set local search_path=observabr,public,extensions;
create table source_documents (
  sha256 text primary key check(length(sha256)=64),
  raw bytea not null,
  collected_at timestamptz not null default now()
);
create table records (
  kind text not null check(kind in ('politician','expense','vote','ballot','proposal')),
  id text not null, owner text, title text not null, date date, amount numeric(18,2),
  data jsonb not null, source_url text not null check(source_url like 'https://%'),
  api_url text not null check(api_url like 'https://dadosabertos.camara.leg.br/api/v2/%'),
  field text not null, sha256 text references source_documents not null,
  collector_version text not null default '1.0.0',
  verified_at timestamptz not null default now(), search_text text not null,
  primary key(kind,id)
);
create index records_owner on records(owner,kind,date desc);
create index records_date on records(kind,date desc,id);
create index records_uf on records((data->>'uf')) where kind='politician';
create index records_search on records using gin(search_text gin_trgm_ops);
create index records_fts on records using gin(to_tsvector('portuguese',search_text));
create table data_revisions (
  revision bigint generated always as identity primary key,
  kind text not null,id text not null,previous jsonb not null,changed_at timestamptz not null default now()
);
create function save_revision() returns trigger language plpgsql set search_path=observabr,pg_catalog as $$
begin
  if (old.title,old.data,old.owner,old.date,old.amount,old.source_url) is distinct from
     (new.title,new.data,new.owner,new.date,new.amount,new.source_url) then
    insert into data_revisions(kind,id,previous) values(old.kind,old.id,to_jsonb(old));
  end if;
  return new;
end $$;
create trigger record_history before update on records for each row execute function save_revision();
create table collection_jobs (
  key text primary key, kind text not null, task jsonb not null,
  page integer not null default 1 check(page>0),status text not null default 'queued' check(status in ('queued','running','done','failed')),
  updated_at timestamptz not null default now(),due_at timestamptz not null default now(),error text,priority integer not null default 10
);
create index collection_schedule on collection_jobs(priority,due_at);
create table collection_requests (
  id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 3 and 100),
  status text not null default 'queued',requested_at timestamptz not null default now(),job_key text
);
create unique index requests_open on collection_requests(lower(name)) where status='queued';
grant select on records,collection_jobs to observabr_reader;
grant select(id,status,requested_at),insert(name) on collection_requests to observabr_reader;
grant select,insert,update on all tables in schema observabr to observabr_writer;
grant usage on all sequences in schema observabr to observabr_writer;
do $$ declare tbl text; begin
 foreach tbl in array array['records','collection_jobs','collection_requests','source_documents','data_revisions'] loop
   execute format('alter table %I enable row level security',tbl);
   execute format('create policy collector on %I for all to observabr_writer using(true) with check(true)',tbl);
 end loop;
end $$;
create policy published on records for select to observabr_reader using(true);
create policy monitor on collection_jobs for select to observabr_reader using(true);
create policy track_request on collection_requests for select to observabr_reader using(true);
create policy submit_request on collection_requests for insert to observabr_reader with check(status='queued');
commit;
