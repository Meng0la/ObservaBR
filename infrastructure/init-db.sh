#!/bin/sh
set -eu

for migration in /migrations/*.sql; do
  psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=on --file "$migration"
done

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=on <<'SQL'
\getenv api_password READER_PASSWORD
\getenv worker_password WRITER_PASSWORD
CREATE ROLE observabr_api LOGIN PASSWORD :'api_password' IN ROLE observabr_reader;
CREATE ROLE observabr_scout LOGIN PASSWORD :'worker_password' IN ROLE observabr_writer;
SQL
