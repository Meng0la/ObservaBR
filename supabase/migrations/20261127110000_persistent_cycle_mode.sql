begin;
alter table observabr.collection_cycles add column mode text;
-- Known earlier completed cycles prove refresh. Ambiguous pre-migration cycles
-- retain the conservative backfill classification; mutable job status is not evidence.
update observabr.collection_cycles c set mode=case when exists(
 select 1 from observabr.collection_cycles previous where previous.job_key=c.job_key
 and previous.completed_at is not null and previous.completed_at<=c.started_at and previous.id<>c.id
) then 'refresh' else 'backfill' end;
alter table observabr.collection_cycles alter column mode set not null;
alter table observabr.collection_cycles add constraint cycle_mode_check check(mode in ('backfill','refresh'));
create function observabr.keep_cycle_identity() returns trigger language plpgsql
 set search_path=observabr,pg_catalog as $$ begin
 if (new.mode,new.job_key) is distinct from (old.mode,old.job_key) then
  raise exception 'Classificação e origem do ciclo são imutáveis';
 end if;
 return new;
end $$;
revoke all on function observabr.keep_cycle_identity() from public;
create trigger cycle_identity before update on observabr.collection_cycles
 for each row execute function observabr.keep_cycle_identity();
commit;
