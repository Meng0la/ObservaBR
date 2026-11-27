begin;
alter table observabr.records add column collected_at timestamptz;
update observabr.records r set collected_at=d.collected_at from observabr.source_documents d where r.sha256=d.sha256;
alter table observabr.records alter column collected_at set not null, alter column collected_at set default now();
create index records_ballot on observabr.records((data->>'voteId')) where kind='ballot';
commit;
