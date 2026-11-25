# Arquitetura implementada
Monólito modular em Node com dois processos. Vite compila HTML/CSS/ES Modules. Fastify serve o build e consultas parametrizadas. Scout consulta rotas fixas da Câmara e grava páginas em transações PostgreSQL. A API usa grupo reader e o coletor writer com RLS no esquema privado observabr.
records guarda projeções por tipo e referência obrigatória a source_documents. O bruto permanece privado. data_revisions registra alterações de conteúdo. collection_jobs mantém tarefa, página, prioridade e próxima execução. Um advisory lock permite um consumidor.
O módulo financeiro usa NUMERIC(18,2). Busca usa unaccent, trigramas e FTS. As extensões são instaladas pelas migrations.
Supabase é um destino PostgreSQL previsto. Storage, DuckDB, Parquet, R2 e IA pertencem ao planejamento. Preservar este desenho modular até métricas justificarem separação.

