-- Sanitized representation of the operational service-role bootstrap.
-- Passwords and LOGIN provisioning belong to private deployment automation.
-- New Docker volumes provision the two logins in infrastructure/init-db.sh.
-- The original remote bootstrap must never be replayed or exported with credentials.
do $$ begin
 if exists(select from pg_roles where rolname='observabr_api') then
  alter role observabr_api connection limit 8;
 end if;
 if exists(select from pg_roles where rolname='observabr_scout') then
  alter role observabr_scout connection limit 3;
 end if;
end $$;
