begin;
alter table observabr.collection_jobs drop constraint collection_jobs_status_check;
alter table observabr.collection_jobs add constraint collection_jobs_status_check check(status in ('queued','running','done','failed','dead','quarantined'));
alter table observabr.collection_jobs add column attempts integer not null default 0 check(attempts>=0),
 add column max_attempts integer not null default 5 check(max_attempts between 1 and 20),
 add column started_at timestamptz,add column cycle_id uuid;
create table observabr.record_aliases (
 kind text not null,alias_id text not null,record_id text not null,sha256 text not null references observabr.source_documents,
 field text not null,plan_sha256 text not null check(length(plan_sha256)=64),created_at timestamptz not null default now(),
 primary key(kind,alias_id),foreign key(kind,record_id) references observabr.records(kind,id)
);
create table observabr.collection_kind_state(kind text primary key,last_served_at timestamptz not null default 'epoch');
insert into observabr.collection_kind_state(kind) values('politician'),('expense'),('proposal'),('vote'),('ballot');
create table observabr.collection_cycles (
 id uuid primary key default gen_random_uuid(),job_key text not null references observabr.collection_jobs(key),
 started_at timestamptz not null default now(),completed_at timestamptz,finished_at timestamptz,
 status text not null default 'running' check(status in ('running','partial','complete')),
 source_rows bigint not null default 0,validated_rows bigint not null default 0,published_rows bigint not null default 0,pages integer not null default 0
);
alter table observabr.collection_jobs add foreign key(cycle_id) references observabr.collection_cycles(id);
create table observabr.collection_observations (
 cycle_id uuid not null references observabr.collection_cycles,kind text not null,id text not null,
 sha256 text not null references observabr.source_documents,field text not null,
 primary key(cycle_id,kind,id,sha256,field),foreign key(kind,id) references observabr.records(kind,id) on update cascade
);
create table observabr.collection_absences (
 cycle_id uuid not null references observabr.collection_cycles,kind text not null,id text not null,
 interpretation text not null default 'not_observed_in_complete_cycle',primary key(cycle_id,kind,id),
 foreign key(kind,id) references observabr.records(kind,id) on update cascade
);
create table observabr.collection_receipts (
 cycle_id uuid not null references observabr.collection_cycles,page integer not null,
 sha256 text not null references observabr.source_documents,source_rows integer not null,published_rows integer not null,
 collected_at timestamptz not null default now(),primary key(cycle_id,page)
);
create table observabr.collection_quarantine (
 job_key text not null references observabr.collection_jobs(key),page integer not null,
 sha256 text not null references observabr.source_documents,error text not null,created_at timestamptz not null default now(),primary key(job_key,page,sha256)
);
create table observabr.collection_runs (
 id uuid primary key default gen_random_uuid(),started_at timestamptz not null default now(),finished_at timestamptz,
 tasks integer not null default 0,pages integer not null default 0,records integer not null default 0,
 failures integer not null default 0,bytes bigint not null default 0,requests integer not null default 0,status text not null default 'running',config jsonb not null
);
create index collection_ready on observabr.collection_jobs(kind,due_at,priority,key) where status in ('queued','failed','done');
create index observations_record on observabr.collection_observations(kind,id);
create index cycles_job on observabr.collection_cycles(job_key,completed_at desc);
do $$ declare tbl text; begin
 foreach tbl in array array['record_aliases','collection_kind_state','collection_cycles','collection_observations','collection_absences','collection_receipts','collection_quarantine','collection_runs'] loop
  execute format('alter table observabr.%I enable row level security',tbl);
  execute format('grant select on observabr.%I to observabr_reader',tbl);
  execute format('grant select,insert,update on observabr.%I to observabr_writer',tbl);
  execute format('create policy published on observabr.%I for select to observabr_reader using(true)',tbl);
  execute format('create policy collector on observabr.%I for all to observabr_writer using(true) with check(true)',tbl);
 end loop;
 if not exists(select from pg_roles where rolname='observabr_backup') then create role observabr_backup nologin; end if;
 for tbl in select tablename from pg_tables where schemaname='observabr' loop
  execute format('create policy backup_read on observabr.%I for select to observabr_backup using(true)',tbl);
 end loop;
end $$;
grant usage on schema observabr,extensions to observabr_backup;
grant select on all tables in schema observabr to observabr_backup;
grant select on all sequences in schema observabr to observabr_backup;
commit;
