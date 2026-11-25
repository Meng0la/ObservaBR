# ObservaBR
Plataforma independente e apartidária para consulta de dados públicos com evidências. Versão inicial 0.1.0, em auditoria de fundação. O índice implementado usa dados da Câmara dos Deputados.

## Execução
Requer Node 24 compatível com package.json e PostgreSQL 17 com pg_trgm e unaccent.
Instale dependências com npm ci. Execute npm run build. Aplique as migrations em supabase/migrations em ordem usando um administrador, uma vez por banco. Crie os logins de leitura e coleta conforme infrastructure/init-db.sh. Configure DATABASE_URL para o login adequado em cada processo. Execute npm start e npm run worker em processos distintos.
Para Docker, copie .env.example para .env, preencha três senhas distintas e execute docker compose up --build. A aplicação fica em http://localhost:3000. As migrations de inicialização só rodam em volume novo. Atualizações de banco existente exigem aplicação controlada de cada migration pendente.

## Validação
npm test, npm run typecheck e npm run build. TEST_DATABASE_URL habilita integração em banco descartável com migrations aplicadas. OBSERVABR_LIVE=1 habilita contratos oficiais e requer rede. Testes de navegador usam CHROME_BIN e node --test apps/web/tests/browser.test.mjs. O teste live requer OBSERVABR_TEST_URL.

## Cobertura
Busca, perfis, despesas, proposições, votações, votos nominais, CSV/JSON por página, proveniência, revisões e fila possuem implementação. Cobertura e períodos são parciais. O banco local preservado contém 513 deputados, 100 despesas, 46 proposições, 1.585 votações e 404 registros nominais.
A coleta de despesas foi interrompida na segunda página. Consulte docs/PROJECT_STATE.md para o diagnóstico e a retomada. Supabase remoto, demais fontes e IA aguardam implementação ou homologação.

Leia docs/PROJECT_STATE.md, docs/DATA_SOURCES.md, docs/THREAT_MODEL.md e DESIGN.md antes de contribuir. Licença MIT para o código próprio. As fontes conservam suas condições de reutilização.

