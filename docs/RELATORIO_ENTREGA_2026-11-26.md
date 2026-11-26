# ObservaBR — relatório de implementação e migração

Data: 26/11/2026. Projeto remoto: `ajhvfqqooqamnoqxqnvh`, região us-west-2. Repositório: [Meng0la/ObservaBR](https://github.com/Meng0la/ObservaBR).

## Resultado desta entrega
O acervo existente foi copiado integralmente para o PostgreSQL do Supabase. As nove tabelas foram comparadas com a origem por contagem e SHA-256 do conteúdo canônico em UTC, sem divergências. Os bytes de todos os documentos também correspondem a seus hashes originais. O banco local foi preservado.

Site e API publicados em **https://observabr.onrender.com**. O serviço Render `srv-dc454l15efls73d3i01g` ficou live no plano Free, workspace My Workspace confirmado pelo mantenedor, usando Docker e o commit 8124696. O reader conectou por TLS ao pooler oficial, e o Scout executou em runner GitHub-hosted. A variável de agendamento está true e o workflow está active. A operação publicada não usa API, Scout nem PostgreSQL locais; a cópia local foi preservada como backup.

## O que já foi implementado no projeto
1. Fundação modular: API Fastify de leitura, Scout de escrita, PostgreSQL, migrations, Docker/Compose, CI no GitHub e documentação de governança, fontes, ameaças e arquitetura.
2. Proveniência por registro: origem, identificador, campo, datas de coleta/verificação, versão do coletor e SHA-256. Documentos originais privados, revisões de conteúdo, idempotência e checkpoints por página.
3. Segurança dos coletores: recursos institucionais homologados, validação de destino e redirecionamento, limites de tamanho/tempo, tratamento de falhas e preservação de valores ausentes. A API não realiza downloads de URLs arbitrárias.
4. Dados iniciais da Câmara: representantes, despesas parciais, proposições, autorias, votações e votos nominais. Cobertura e significado documental permanecem explícitos.
5. Interface editorial e documental: panorama, pesquisa, diretório com filtros e exportação no servidor, perfil, evidências, mapa por UF, gráficos, grafo e demonstração do design system. Temas claro/escuro e fontes locais.
6. Enriquecimento legislativo: fila persistente, cache por recurso, contexto de votação, objeto efetivo, autoria, placar, votos, partidos, orientações, tramitação, documentos e vínculos. O placar proclamado e os registros nominais continuam separados.
7. API Explorer: dados interpretados, projeção publicável da resposta coletada, metadados, hashes, supressões explícitas, busca, cópia e exportação. O bruto privado não é apresentado como resposta pública integral.
8. Correções operacionais: rota complementar de votação, preservação do contexto em novas coletas, rótulos de processamento e acompanhamento da fila na aba Contexto. Scout dedicado ao enriquecimento.
9. Identidade animada: olho SVG no cabeçalho, contorno fixo, íris/pupila com movimento suave e limitado, retorno ao centro, tokens de tema, versão estática em touch/movimento reduzido e favicon estático. Componente reutilizável documentado em DESIGN.md.

Os resultados detalhados das fases anteriores estão em PHASE02_VALIDATION.md, ENRICHMENT_VALIDATION.md, VOTE_AUDIT.md e DESIGN.md. As contagens históricas desses documentos representam seus respectivos checkpoints; a tabela abaixo corresponde ao snapshot efetivamente migrado.

## Migração executada
As migrations 001 e 002 já estavam aplicadas manualmente pelo mantenedor. O schema remoto estava vazio. Foi aplicada a migration 003 de enriquecimento, sem repetir as anteriores.

Foi criado um backup PostgreSQL em formato custom antes da transferência, em `.tools/cloud-migration/pre-transfer.dump`. O exportador `scripts/export-supabase.ts` leu a origem em transação REPEATABLE READ, sem escritores locais ativos. Gerou 38 lotes privados, importados em ordem de dependência, preservando chaves, datas, NUMERIC, JSONB, documentos e revisões. A sequência das revisões foi ajustada ao maior ID importado, 1.994.

| Tabela | Linhas importadas | Comparação integral |
|---|---:|---|
| source_documents | 53 | SHA-256 idêntico |
| records | 2.762 | SHA-256 idêntico |
| data_revisions | 1.994 | SHA-256 idêntico |
| collection_jobs | 2.616 | SHA-256 idêntico |
| collection_requests | 0 | SHA-256 idêntico |
| api_snapshots | 53 | SHA-256 idêntico |
| enrichment_jobs | 4 | SHA-256 idêntico |
| entity_contexts | 4 | SHA-256 idêntico |
| enrichment_documents | 34 | SHA-256 idêntico |

Os 2.762 registros publicados são 513 representantes, 100 despesas, 160 registros de proposições, 1.585 votações e 404 votos nominais. Há 46 vínculos de autoria. Os quatro contextos representam cobertura complementar parcial, sem expansão automática para fontes ainda não homologadas.

Os documentos brutos totalizam 1.426.028 bytes. Nenhum hash de documento divergiu. O banco remoto medido ocupa aproximadamente 20,7 MB, incluindo estruturas internas. Os hashes agregados estão em [SUPABASE_IMPORT_VERIFICATION.json](SUPABASE_IMPORT_VERIFICATION.json), que não contém documentos ou credenciais. Eles comprovam o snapshot importado antes de ativar os processos; as tabelas operacionais podem mudar normalmente depois do consumo da fila.

A primeira comparação agregada apresentou diferenças porque a origem usa America/Sao_Paulo e o remoto usa UTC. O método foi normalizado para UTC e todas as tabelas passaram. Os instantes coletados foram preservados; não houve alteração dos bytes para forçar equivalência.

## Segurança e credenciais
Foram criados `observabr_api` e `observabr_scout`, com senhas aleatórias distintas e grupos reader/writer separados. Não têm superusuário, bypass de RLS, criação de bancos/roles ou replicação. Os limites de conexão são oito para API e três para Scout. As senhas estão em arquivo privado ignorado pelo Git e pelo Docker; não constam neste relatório.

RLS está habilitado nas nove tabelas. A API não tem SELECT sobre os documentos brutos; o Scout tem os privilégios necessários. `anon` e `authenticated` não têm acesso ao schema `observabr`. O bruto permanece no PostgreSQL privado, conforme a arquitetura existente.

A migration `20261126115704_cloud_security.sql` moveu `pg_trgm` e `unaccent` para `extensions`, concedeu USAGE aos grupos da aplicação e restringiu a execução pública da função opcional de evento `public.rls_auto_enable()`. Foi aplicada no remoto, no banco local e no banco de testes. O advisor de segurança do Supabase retornou zero alertas depois da mudança.

A tentativa inicial de executar SET ROLE por meio da sessão administrativa do MCP foi negada, e essa restrição foi preservada. Depois, os próprios logins foram testados por conexão real a aws-1-us-west-2.pooler.supabase.com:5432, a partir do GitHub. O reader confirmou sua identidade, TLS autorizado no socket, consultas públicas e rejeição de SELECT sobre documentos brutos. O writer executou o processamento complementar real. As políticas também são exercitadas na integração local.

A primeira execução remota falhou ao validar a cadeia TLS por falta da CA do Supabase. A CA pública oficial foi adicionada ao conjunto confiável do Node em Docker e nos workflows. sslmode=verify-full e a validação do hostname foram mantidos. A CA, sua origem e fingerprint estão em infrastructure/certs. Nenhuma chave privada foi adicionada ao repositório.

## Tecnologias preservadas
| Camada | Implementação atual |
|---|---|
| Frontend | HTML semântico, CSS próprio, Vanilla JavaScript/ES Modules e Vite 8.3.8 |
| Visualização | Apache ECharts 6.1.0, Cytoscape.js 3.35.0 e MapLibre GL JS 6.19.0, com imports dinâmicos |
| Marca e tipografia | SVG próprio, Manrope, Newsreader e IBM Plex Mono; cores centralizadas em tokens.css |
| Backend | Node.js LTS 24.22.3, TypeScript 5.9.3, Fastify 5.12.8 e Zod 4.6.7 |
| Coleta | Transporte institucional Node HTTPS com controles de DNS/destino; Undici disponível na stack |
| Persistência | PostgreSQL 17.12 no Supabase, NUMERIC(18,2), JSONB, FTS, pg_trgm, unaccent, RLS e fila SQL |
| Testes | Node test runner, Playwright/Chrome real, smokes HTTP, testes de banco e sentinela de segredos |
| Operação | Docker, Docker Compose, GitHub Actions; site/API ativos no Render Free |

Cloudflare Pages permanece previsto para site estático separado; não foi provisionado. Workers são usados quando houver compatibilidade demonstrada. Redis, pgvector, Cheerio, Supabase Storage/S3, R2, Parquet/Zstandard, DuckDB e IA continuam condicionados aos casos e medições documentados. Cheerio e automação de páginas não são necessários para os endpoints JSON atuais. Playwright já é usado na validação da interface. Nenhuma tecnologia futura foi apresentada como implementada.

## Operação gratuita ativada
Um único web service Docker foi criado pelo MCP do Render com plano free e DATABASE_URL do reader fornecida ao gerenciador de variáveis. O próprio Fastify serve o frontend compilado e a API na mesma origem. Não foi criado banco adicional nem worker pago. render.yaml permanece como referência recuperável, sem vínculo com Blueprint gerenciado. A criação direta disponível não expôs healthCheckPath: o healthcheck do Render é TCP. /api/health foi testado por HTTPS contra o banco real; configurar esse caminho como healthcheck HTTP no painel permanece recomendado.

O novo modo `--enrichment-batch` do Scout termina quando não há trabalho, após três entidades por padrão ou ao atingir o limite entre entidades. Mantém o lock, cache e tentativas existentes e não reinicializa a fila geral. `.github/workflows/scout.yml` executa a cada quinze minutos em runner padrão do GitHub. O secret foi configurado de forma criptografada e `OBSERVABR_SCOUT_ENABLED=true` foi ativada depois do teste manual aprovado.

O lote recebe exclusivamente a conexão writer via secret `OBSERVABR_SCOUT_DATABASE_URL`. A coleta geral e a conciliação financeira pendente não foram ativadas pelo agendamento. O modo não acelera o acesso às fontes nem contorna bloqueios.

O workflow manual Verificar API no Supabase usa um secret reader distinto, OBSERVABR_API_DATABASE_URL. [Validação do reader](https://github.com/Meng0la/ObservaBR/actions/runs/45850926621). Para comprovar processamento, o caso já indexado 2520670-66 foi recolocado na fila; o runner processou seus snapshots em cache, e job/contexto passaram a done com atualização em 26/11/2026 às 12h40 BRT. [Execução do Scout](https://github.com/Meng0la/ObservaBR/actions/runs/45851269157). Não foi necessário um processo local para consumir a fila.

O roteiro de publicação, conexões, proteção de credenciais, ativação do Scout e recuperação está em [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md).

## Validação desta tarefa
- Importação real no Supabase: nove tabelas com contagens e hashes integrais iguais à origem; 53 documentos com hash válido; sequência de revisões ajustada.
- Segurança remota: nove tabelas com RLS, logins separados, bruto inacessível ao reader, extensões em schema próprio e zero alertas no advisor.
- npm test com observabr_test: 15 aprovados, dois contratos externos ignorados, zero falhas na execução final.
- Testes novos pelo ponto de entrada real do Scout: limites inválidos, exclusão pelo advisory lock, encerramento do lote e preservação da fila geral.
- Typecheck, build de produção e git diff --check aprovados. Permanecem os avisos existentes de chunks grandes e depreciações Fastify/pg.
- A sentinela de segredo não apareceu nos 20 arquivos publicados pelo build. As quatro migrations foram aplicadas em banco isolado vazio. O backup integral também foi restaurado e atualizado em banco temporário, com 2.762 registros, 1.994 revisões e zero hashes brutos inválidos. A primeira tentativa com data-only falhou por ordem de FKs; a recuperação foi validada restaurando schema e dados juntos. Os bancos temporários foram removidos.
- O primeiro teste de lote usava contagem global concorrente, afetada por outros testes. Foi substituído por uma sentinela própria; também foi corrigida a reinicialização indevida da fila geral no modo em lote.
- A CLI Supabase 3.4.0 gerou a migration. O ambiente exigiu o repositório confiável de certificados do Windows e permissão para a configuração da CLI; TLS não foi desativado.
- O deploy Render foi acompanhado até live; nenhum erro apareceu na consulta de logs de aplicação por nível error.
- A [verificação completa no GitHub](https://github.com/Meng0la/ObservaBR/actions/runs/45850902246) passou para o commit 8124696, além dos workflows específicos de conexão e Scout.
- HTTPS público aprovado para saúde, resumo, diretório com filtros reais de partido/UF, CSV, votação, placar de 402, total nominal de 404, evidências publicáveis e erros de entrada esperados. Smoke reutilizável em tests/public-smoke.mjs.
- Chrome no endereço público: mapa, olho animado, temas, responsividade em 390/1440 px, votação, votos e Explorer aprovados, sem erros de console. Nove capturas em .tools/cloud-migration/screens; mapa móvel e Explorer inspecionados visualmente. As capturas foram feitas após carregar e trazer o canvas do mapa para a área visível, evitando registrar um frame anterior ao carregamento.
- Os testes visuais anteriores continuam documentados na entrega da identidade. Esta tarefa não altera o frontend; valida sua publicação real.

## Pendências e limites reais
1. Definir backup externo automático e validar sua própria restauração. O backup anterior à importação ainda é local; sua restauração integral já foi testada.
2. Reconciliar o histórico de migrations aplicadas manualmente antes de automatizar db push. O deploy não roda migrations automaticamente.
3. Configurar o healthcheck HTTP no painel Render, se desejado; a ferramenta de criação disponível usa TCP. O caminho de saúde já é verificado pelos smokes.

O gratuito implica suspensão por inatividade, quotas e ausência de SLA. O Render Free pode levar cerca de um minuto para retomar após quinze minutos ocioso. O GitHub pode atrasar agendamentos. A cobertura continua parcial: não foram implementadas novas instituições, cobertura nacional completa, conciliação integral das despesas ou módulos de IA. O caso financeiro anterior permanece pendente na página 2 e o script de reidentificação não foi executado.

Não foi contratado serviço pago nem realizado deploy em outro projeto Supabase. Os projetos pcm-aerocris e radar-vagas não foram alterados. Site, API, banco e Scout complementar agora executam na nuvem. Os limites do gratuito permanecem; independência do computador não representa garantia de disponibilidade contínua ou expansão automática da cobertura.
