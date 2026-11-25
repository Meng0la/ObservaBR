# Continuidade — Fase 01
Checkpoint de auditoria em 25/11/2026. Última tarefa concluída foi a auditoria da fundação, documentação permanente e correção do carregamento do worker MapLibre. Próxima tarefa é a Fase 02, mediante instrução do usuário. A pendência de conciliação de despesas deve ser resolvida antes de apresentar totais completos.

## Estado real
Pasta com código, sem diretório .git. git status falha com “not a git repository”. Histórico, branch e autoria de alterações não puderam ser auditados. Nenhuma reinicialização foi realizada.
API Fastify, frontend Vite, Scout e PostgreSQL estão implementados. As únicas integrações de registros são cinco recursos da Câmara. A malha IBGE é um arquivo local. Consulte README e architecture/OVERVIEW.md.

## Dados preservados e diagnóstico
Consultas diretas ao PostgreSQL confirmaram 513 políticos, 100 despesas, 46 vínculos de proposições, 1.585 votações e 404 registros de voto nominal.
As despesas de 204379/2025 pararam na página 2 com “Chaves ambíguas na página da Câmara”. O código atual já incorpora competência e data à chave. O script scripts/reidentify-expenses.ts existe para reconciliar as identidades antigas a partir de evidências, mas sua execução e a retomada completa permanecem pendentes nesta auditoria.
As proposições são de um autor e ano. As votações são do recorte mensal de dezembro de 2025. A listagem de deputados é a retornada pela fonte no momento da coleta e exige validação adicional de mandatos para afirmar exercício histórico.
Fila consultada com 1.584 ballots pendentes, um concluído, 513 despesas e 513 proposições pendentes. Há uma despesa falha e um trabalho de votação pendente. O worker tem lock exclusivo e foi executado de forma limitada na implementação anterior. Prioridades e volume de votos podem atrasar despesas.

## Correção validada
Mapa tinha canvas e dimensões válidas, mas worker falhava ao carregar. visuals.js passou a configurar setWorkerUrl com módulo emitido pelo Vite. Screenshot posterior mostrou polígonos estaduais. Teste passou a observar console e canvas.
Screenshots locais em .tools/audit-desktop.png e .tools/audit-mobile.png. O estilo foi preservado para revisão posterior. Inter continua no frontend e será substituída na Fase 02.

## Verificação executada
npm test com TEST_DATABASE_URL isolada — 6 aprovados, 1 contrato ao vivo ignorado, zero falhas.
npm run typecheck — aprovado. npm run build — aprovado com aviso de chunk acima de 500 kB.
Teste Chrome browser.test.mjs — aprovado após correção e reforço da verificação.
node tests/http-smoke.mjs — aprovado contra aplicação e PostgreSQL reais.
Contrato ao vivo e auditoria npm de rede não foram repetidos nesta fase. Relatos anteriores de execução estão em CAMARA.md. Docker Engine não está disponível para validação de containers nesta máquina. CI existe, mas sua execução remota não foi verificada.

## Banco e ambiente
Migrations 001_core e 002_observacoes. Seis tabelas efetivas, sem toda a normalização nacional planejada. RLS com grupos reader/writer e esquema privado. PostgreSQL portátil preservado em .tools na porta 54672, Node portátil 24.22.3. Credenciais locais em arquivos ignorados .tools/*.pass, nunca copiar para documentação ou logs.
Dependências fixadas e lock presente. Não foram instaladas ferramentas adicionais nesta auditoria. Supabase hospedado, R2, DuckDB, Parquet, Zstandard, Redis e pgvector aguardam necessidade e configuração.

## Comandos
README descreve npm ci, build, API, worker e Docker. No ambiente portátil acrescente .tools/node-v24.22.3-win-x64 ao PATH. Use DATABASE_URL de reader na API e writer no Scout. TEST_DATABASE_URL deve apontar exclusivamente a observabr_test.
A aplicação já estava ativa na porta 3000. Uma tentativa de segunda instância retornou EADDRINUSE, sem interromper a instância existente. O PostgreSQL também já estava ativo.

## Riscos e pendências
Conciliação de identidades e exclusões de origem, retenção de bruto, limite global da fila, recuperação de backup, consentimento operacional para infraestrutura e procedimento de correções permanecem pendentes. O limite HTTP é por instância. Fila usa prioridade fixa e pode causar espera longa. Histórico mostrado depende da amostra indexada. Solicitação de correção tem orientação textual e depende de canal do mantenedor.
RAG, cadastro nacional, fontes adicionais, financeiro do projeto e módulo judicial aguardam implementação. Não há deploy autorizado nesta fase.


## Checkpoint intermediário da Fase 02
Backup seletivo em .tools/phase02-recovery, sem credenciais. Capturas anteriores em .tools/phase02/before. Duas propostas locais geradas e inspecionadas, escolha híbrida registrada em DESIGN_REFERENCES.md. Implementação do frontend em andamento. Filtros reais de partido e ordenação adicionados à API com testes em banco isolado. Nenhuma coleta ou migration foi executada nesta fase.
