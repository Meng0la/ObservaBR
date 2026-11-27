begin;

-- Correct only the text encoding introduced by the original Windows client.
-- CREATE OR REPLACE preserves the function OID, owner and existing ACL.
create or replace function observabr.keep_cycle_identity() returns trigger
language plpgsql
set search_path=observabr,pg_catalog
as $$ begin
 if (new.mode,new.job_key) is distinct from (old.mode,old.job_key) then
  raise exception 'Classificação e origem do ciclo são imutáveis';
 end if;
 return new;
end $$;

commit;
