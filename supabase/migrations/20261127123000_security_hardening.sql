begin;

-- The public API only needs aliases, coverage cycles and a narrow job projection.
revoke all on observabr.record_aliases,observabr.collection_kind_state,observabr.collection_cycles,
 observabr.collection_observations,observabr.collection_absences,observabr.collection_receipts,
 observabr.collection_quarantine,observabr.collection_runs from observabr_reader;
revoke all on observabr.collection_jobs from observabr_reader;
grant select(kind,alias_id,record_id) on observabr.record_aliases to observabr_reader;
grant select(id,job_key,started_at,completed_at,finished_at,status,source_rows,validated_rows,published_rows,pages,scope_from,scope_to,mode)
 on observabr.collection_cycles to observabr_reader;
grant select(key,kind,task,page,status,updated_at,due_at) on observabr.collection_jobs to observabr_reader;

-- Collected bytes and audit rows are append-only for the Scout role.
revoke update,delete,truncate on observabr.source_documents,observabr.data_revisions,
 observabr.collection_observations,observabr.collection_absences,observabr.collection_receipts,
 observabr.collection_quarantine from observabr_writer;
revoke all on observabr.collection_kind_state,observabr.collection_cycles,observabr.collection_observations,
 observabr.collection_absences,observabr.collection_receipts,observabr.collection_quarantine,
 observabr.collection_runs,observabr.record_aliases from observabr_writer;
grant select,insert on observabr.record_aliases to observabr_writer;
grant select,update on observabr.collection_kind_state to observabr_writer;
grant select,insert,update on observabr.collection_cycles to observabr_writer;
grant select,insert on observabr.collection_observations,observabr.collection_absences,observabr.collection_receipts to observabr_writer;
grant insert on observabr.collection_quarantine to observabr_writer;
grant select,insert,update on observabr.collection_runs to observabr_writer;

create or replace function observabr.keep_cycle_identity() returns trigger language plpgsql
 set search_path=observabr,pg_catalog as $$
declare totals record;
begin
 if (new.mode,new.job_key,new.started_at,new.scope_from,new.scope_to) is distinct from
    (old.mode,old.job_key,old.started_at,old.scope_from,old.scope_to) then
  raise exception 'Identidade e escopo do ciclo são imutáveis';
 end if;
 if old.status in ('partial','complete') and new is distinct from old then
  raise exception 'Ciclo encerrado é imutável';
 end if;
 if old.status='running' and new.status not in ('running','partial','complete') then
  raise exception 'Transição de ciclo inválida';
 end if;
 select coalesce(sum(source_rows),0)::bigint source_rows,
  coalesce(sum(published_rows),0)::bigint published_rows,count(*)::integer pages
  into totals from observabr.collection_receipts where cycle_id=old.id;
 new.source_rows:=totals.source_rows;
 new.validated_rows:=totals.source_rows;
 new.published_rows:=totals.published_rows;
 new.pages:=totals.pages;
 if new.status='complete' and (new.completed_at is null or new.finished_at is null) then
  raise exception 'Conclusão exige timestamps de encerramento';
 end if;
 if new.status='partial' and new.finished_at is null then
  raise exception 'Ciclo parcial exige encerramento';
 end if;
 return new;
end $$;
revoke all on function observabr.keep_cycle_identity() from public;

commit;
