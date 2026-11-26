# Arquitetura implementada
Monólito modular em Node com dois processos. Vite compila HTML/CSS/ES Modules. Fastify serve o build e consultas parametrizadas. Scout consulta rotas fixas da Câmara e grava páginas em transações PostgreSQL. A API usa grupo reader e o coletor writer com RLS no esquema privado observabr.
records guarda projeções por tipo e referência obrigatória a source_documents. O bruto permanece privado. data_revisions registra alterações de conteúdo. collection_jobs mantém tarefa, página, prioridade e próxima execução. Um advisory lock permite um consumidor.
O módulo financeiro usa NUMERIC(18,2). Busca usa unaccent, trigramas e FTS. As extensões são instaladas pelas migrations.
O acervo foi importado e verificado no PostgreSQL do Supabase em 26/11/2026. A operação dos processos no provedor ainda aguarda ativação; CLOUD_DEPLOYMENT.md e PROJECT_STATE.md distinguem dados migrados de runtime publicado. Storage, DuckDB, Parquet, R2 e IA pertencem ao planejamento. Preservar este desenho modular até métricas justificarem separação.

