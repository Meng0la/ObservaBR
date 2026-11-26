begin;
create table observabr.api_snapshots (
 id text primary key,resource text not null,external_id text not null,api_url text not null check(api_url like 'https://dadosabertos.camara.leg.br/api/v2/%'),
 sha256 text not null references observabr.source_documents,payload jsonb not null,original boolean not null,
 suppressed_fields jsonb not null default '[]',collected_at timestamptz not null default now(),verified_at timestamptz not null default now(),
 collector_version text not null default '2.0.0',unique(api_url,sha256)
);
create index snapshot_resource on observabr.api_snapshots(resource,external_id,verified_at desc);
create table observabr.enrichment_jobs (
 kind text not null,external_id text not null,status text not null default 'queued' check(status in ('queued','running','done','failed')),
 updated_at timestamptz not null default now(),run_after timestamptz not null default now(),error text,
 primary key(kind,external_id),foreign key(kind,external_id) references observabr.records(kind,id)
);
create index enrichment_due on observabr.enrichment_jobs(run_after);
create table observabr.entity_contexts (
 kind text not null,external_id text not null,context jsonb not null,updated_at timestamptz not null default now(),
 primary key(kind,external_id),foreign key(kind,external_id) references observabr.records(kind,id)
);
create index entity_context_search on observabr.entity_contexts using gin(to_tsvector('portuguese',context::text));
create table observabr.enrichment_documents (
 kind text not null,external_id text not null,snapshot_id text not null references observabr.api_snapshots(id),
 primary key(kind,external_id,snapshot_id),foreign key(kind,external_id) references observabr.records(kind,id)
);
grant select on observabr.api_snapshots,observabr.enrichment_jobs,observabr.entity_contexts,observabr.enrichment_documents to observabr_reader;
grant insert(kind,external_id) on observabr.enrichment_jobs to observabr_reader;
grant select,insert,update on observabr.api_snapshots,observabr.enrichment_jobs,observabr.entity_contexts,observabr.enrichment_documents to observabr_writer;
do $$ declare tbl text; begin
 foreach tbl in array array['api_snapshots','enrichment_jobs','entity_contexts','enrichment_documents'] loop
  execute format('alter table observabr.%I enable row level security',tbl);
  execute format('create policy reader on observabr.%I for select to observabr_reader using(true)',tbl);
  execute format('create policy collector on observabr.%I for all to observabr_writer using(true) with check(true)',tbl);
 end loop;
end $$;
create policy request_enrichment on observabr.enrichment_jobs for insert to observabr_reader with check(status='queued');
commit;
