-- Verify the effective privileges of the application logins after bootstrap.
DO $$
BEGIN
  IF NOT pg_has_role('observabr_api','observabr_reader','USAGE') OR
     NOT pg_has_role('observabr_scout','observabr_writer','USAGE') THEN
    RAISE EXCEPTION 'Credenciais de serviço sem o grupo esperado';
  END IF;
  IF EXISTS (
    SELECT FROM pg_roles
    WHERE rolname IN ('observabr_api','observabr_scout')
      AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls)
  ) THEN RAISE EXCEPTION 'Credencial de serviço privilegiada'; END IF;
  IF EXISTS (
    SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='observabr' AND c.relkind IN ('r','p')
      AND has_table_privilege('observabr_api',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
  ) THEN RAISE EXCEPTION 'Escrita concedida à API'; END IF;
  IF EXISTS (
    SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='observabr' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity
  ) THEN RAISE EXCEPTION 'Tabela de dados sem RLS'; END IF;
  IF has_table_privilege('observabr_api','observabr.source_documents','SELECT') THEN
    RAISE EXCEPTION 'Leitor com acesso direto aos documentos brutos';
  END IF;
  IF has_table_privilege('observabr_api','observabr.collection_receipts','SELECT') OR
     has_table_privilege('observabr_api','observabr.collection_quarantine','SELECT') OR
     has_table_privilege('observabr_api','observabr.collection_runs','SELECT') THEN
    RAISE EXCEPTION 'Leitor com acesso ao controle interno da coleta';
  END IF;
  IF has_table_privilege('observabr_scout','observabr.source_documents','UPDATE,DELETE') OR
     has_table_privilege('observabr_scout','observabr.collection_receipts','UPDATE,DELETE') OR
     has_table_privilege('observabr_scout','observabr.collection_observations','UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Scout pode alterar evidência append-only';
  END IF;
  IF NOT has_column_privilege('observabr_api','observabr.collection_requests','name','INSERT') THEN
    RAISE EXCEPTION 'Leitor sem acesso à solicitação de coleta';
  END IF;
END $$;
