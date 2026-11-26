# ObservaBR
Plataforma independente e apartidária para consulta de dados públicos com evidências. Versão 0.1.0 em desenvolvimento, com interface validada e enriquecimento legislativo inicial. O índice implementado usa dados da Câmara dos Deputados.

MVP publicado: **https://observabr.onrender.com**. Site/API no Render Free, dados no Supabase e Scout complementar agendado no GitHub Actions. A operação não requer processos no computador pessoal. O plano gratuito pode suspender o site por inatividade e demorar na primeira abertura.

## Execução
Requer Node 24 compatível com package.json e PostgreSQL 17 com pg_trgm e unaccent.
Instale dependências com npm ci. Execute npm run build. Aplique as migrations em supabase/migrations em ordem usando um administrador, uma vez por banco. Crie os logins de leitura e coleta conforme infrastructure/init-db.sh. Configure DATABASE_URL para o login adequado em cada processo. Execute npm start e npm run worker em processos distintos.
Para Docker, copie .env.example para .env, preencha três senhas distintas e execute docker compose up --build. A aplicação fica em http://localhost:3000. As migrations de inicialização só rodam em volume novo. Atualizações de banco existente exigem aplicação controlada de cada migration pendente.

## Validação
npm test, npm run typecheck e npm run build. TEST_DATABASE_URL habilita integração em banco descartável com migrations aplicadas. OBSERVABR_LIVE=1 habilita contratos oficiais e requer rede. Testes de navegador usam CHROME_BIN e node --test apps/web/tests/browser.test.mjs. O teste live requer OBSERVABR_TEST_URL.

## Cobertura
Busca, perfis, despesas, proposições, votações, votos nominais, CSV/JSON por página, proveniência, revisões e fila possuem implementação. Cobertura e períodos são parciais. O snapshot migrado ao Supabase contém 513 deputados, 100 despesas, 160 registros de proposições entre fichas e referências documentadas, 46 vínculos de autoria, 1.585 votações e 404 registros nominais. A cópia local foi preservada.
A coleta de despesas foi interrompida na segunda página. Consulte docs/PROJECT_STATE.md para o diagnóstico e a retomada. O acervo foi importado e verificado no Supabase remoto; site/API estão publicados e o Scout complementar está agendado na nuvem. Demais fontes e IA aguardam implementação ou homologação.

## Operação na nuvem
O relatório consolidado está em [docs/RELATORIO_ENTREGA_2026-11-26.md](docs/RELATORIO_ENTREGA_2026-11-26.md). O roteiro gratuito, credenciais separadas, limites e recuperação estão em [docs/CLOUD_DEPLOYMENT.md](docs/CLOUD_DEPLOYMENT.md). render.yaml descreve o serviço Docker gratuito como referência; a instância atual foi criada pelo MCP e não deve ser duplicada. O workflow Scout já recebeu seu secret e a variável de ativação. Nenhuma senha faz parte do repositório. `node tests/public-smoke.mjs` verifica a publicação por HTTPS sem alterações nos dados.

Leia docs/PROJECT_STATE.md, docs/DATA_SOURCES.md, docs/THREAT_MODEL.md e DESIGN.md antes de contribuir. Licença MIT para o código próprio. As fontes conservam suas condições de reutilização.


## Interface da Fase 02
O panorama editorial e as consultas documentais compartilham tokens OKLCH, temas claro e escuro e três fontes locais. A rota #sistema demonstra os componentes. O diretório inclui filtros reais de partido e ordenação. Consulte docs/DESIGN_REFERENCES.md e docs/PHASE02_VALIDATION.md para decisões e validação. As limitações da coleta permanecem documentadas em docs/PROJECT_STATE.md.

## Enriquecimento e API Explorer
A votação #registro/vote/2520670-66 demonstra o caso real do PLP 128/2025. A navegação contextual apresenta destaque, autoria, placar, votos, orientações, tramitação e documentos. O Explorer oferece dados interpretados, resposta publicável e metadados. Campos suprimidos são identificados.

Em instalações existentes, consulte docs/MIGRATION_RECONCILIATION.md antes de aplicar SQL: o histórico remoto já contém o enriquecimento como 20261126114431_enrichment e não deve ser reaplicado. Um volume Docker novo aplica os arquivos canônicos em ordem. A migration de engenharia permanece pendente no remoto; não atualizar API/Scout desta branch antes de sua revisão e aplicação autorizada.
Com DATABASE_URL do coletor, node scripts/backfill-evidence.ts disponibiliza as evidências históricas publicáveis e node scripts/backfill-vote-fields.ts recupera campos descartados da listagem. São operações idempotentes que usam o acervo local.
O processo npm run worker consome pedidos complementares feitos na interface. node scripts/enrich.ts vote ID_DA_VOTACAO permite um processamento administrativo delimitado com o mesmo lock e cache.

Consulte docs/architecture/0002-enrichment.md, docs/API_EXPLORER.md, docs/ENRICHMENT_VALIDATION.md e docs/PROJECT_STATE.md para contratos, configuração, testes e cobertura.
Para atender apenas as solicitações complementares da interface, mantenha node apps/worker/index.ts --enrichment-only em execução com a credencial do coletor. A aba Contexto acompanha solicitações pendentes automaticamente. Os modos do Scout compartilham o mesmo lock e devem usar um único consumidor.

## Engenharia de dados — validação controlada

Relatório incremental: [DATA_ENGINEERING_VALIDATION.md](docs/DATA_ENGINEERING_VALIDATION.md). Implementados CLI de lote geral limitado e workflow manual independente, conciliação dry-run com plano por hash, aliases, dead-letter, quarentena e ciclos de cobertura. Produção não recebeu esta branch nem a conciliação financeira; o agendamento complementar existente foi preservado.

Com schema de engenharia instalado em banco isolado e DATABASE_URL writer: `node scripts/collect-batch.ts --kind=expense --owner=204379 --year=2025 --max-tasks=1 --max-seconds=120`. Retoma checkpoints, sem reset. O script `node scripts/reidentify-expenses.ts --owner=204379 --year=2025` apenas planeja por padrão; aplicar exige hash e autorização operacional. O arquivo anual diverge da API; não inverter sinais ou publicar uma fusão por heurística.

[Armazenamento](docs/STORAGE_STRATEGY.md) contém prova com CSV/JSON/PostgreSQL/Parquet-Zstandard, 170.615 observações oficiais e DuckDB exclusivamente local. [Backup e recuperação](docs/BACKUP_RECOVERY.md) documenta cifragem, retenção e restauração ensaiada; destino externo privado ainda pendente. `node scripts/data-metrics.ts` registra snapshots privados e alertas configuráveis em 70/85/95. [Referências arquiteturais e licenças](docs/REFERENCE_ARCHITECTURES.md) registram a auditoria sem novas dependências de produção.
