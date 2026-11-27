begin;
alter table observabr.collection_kind_state add column served bigint not null default 0 check(served>=0);
alter table observabr.collection_cycles add column scope_from date,add column scope_to date;
alter table observabr.collection_cycles add constraint cycle_scope_order check(scope_from is null or scope_to is null or scope_from<=scope_to);
-- No UPDATE/backfill guesses the period of old receipts. A date range must be known at collection time.
create index jobs_period on observabr.collection_jobs(kind,(task->>'year'),due_at)
 where status in ('queued','failed','done');
commit;
