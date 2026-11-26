# ObservaBR — relatório de implementação e migração

Data: 26/11/2026. Projeto remoto: `ajhvfqqooqamnoqxqnvh`, região us-west-2. Repositório: [Meng0la/ObservaBR](https://github.com/Meng0la/ObservaBR).

## Resultado desta entrega
O acervo existente foi copiado integralmente para o PostgreSQL do Supabase. As nove tabelas foram comparadas com a origem por contagem e SHA-256 do conteúdo canônico em UTC, sem divergências. Os bytes de todos os documentos também correspondem a seus hashes originais. O banco local foi preservado.

A publicação dos processos ainda não foi concluída. O Render não está conectado e falta o host oficial do Session pooler para montar as URLs dos serviços. Não existe URL pública validada nem execução comprovada do Scout no GitHub. Portanto, a independência operacional de 100% do computador continua pendente, embora os dados já estejam persistidos remotamente.

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

Os documentos brutos totalizam 1.426.028 bytes. Nenhum hash de documento divergiu. O banco remoto medido ocupa aproximadamente 20,7 MB, incluindo estruturas internas. Os hashes agregados estão em [SUPABASE_IMPORT_VERIFICATION.json](SUPABASE_IMPORT_VERIFICATION.json), que não contém documentos ou credenciais.

A primeira comparação agregada apresentou diferenças porque a origem usa America/Sao_Paulo e o remoto usa UTC. O método foi normalizado para UTC e todas as tabelas passaram. Os instantes coletados foram preservados; não houve alteração dos bytes para forçar equivalência.

## Segurança e credenciais
Foram criados `observabr_api` e `observabr_scout`, com senhas aleatórias distintas e grupos reader/writer separados. Não têm superusuário, bypass de RLS, criação de bancos/roles ou replicação. Os limites de conexão são oito para API e três para Scout. As senhas estão em arquivo privado ignorado pelo Git e pelo Docker; não constam neste relatório.

RLS está habilitado nas nove tabelas. A API não tem SELECT sobre os documentos brutos; o Scout tem os privilégios necessários. `anon` e `authenticated` não têm acesso ao schema `observabr`. O bruto permanece no PostgreSQL privado, conforme a arquitetura existente.

A migration `20261126115704_cloud_security.sql` moveu `pg_trgm` e `unaccent` para `extensions`, concedeu USAGE aos grupos da aplicação e restringiu a execução pública da função opcional de evento `public.rls_auto_enable()`. Foi aplicada no remoto, no banco local e no banco de testes. O advisor de segurança do Supabase retornou zero alertas depois da mudança.

A tentativa de executar SET ROLE por meio da sessão administrativa do MCP foi negada. Essa restrição foi preservada. Os privilégios remotos foram conferidos por catálogo e advisor; o teste de login com as credenciais efetivas ainda depende do endpoint do pooler. As políticas também são exercitadas na integração local.

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
| Operação | Docker, Docker Compose, GitHub Actions; configuração Render Free preparada |

Cloudflare Pages permanece previsto para site estático separado; não foi provisionado. Workers são usados quando houver compatibilidade demonstrada. Redis, pgvector, Cheerio, Supabase Storage/S3, R2, Parquet/Zstandard, DuckDB e IA continuam condicionados aos casos e medições documentados. Cheerio e automação de páginas não são necessários para os endpoints JSON atuais. Playwright já é usado na validação da interface. Nenhuma tecnologia futura foi apresentada como implementada.

## Preparação da operação gratuita
`render.yaml` define um único web service Docker com plano free, healthcheck e DATABASE_URL fornecida pelo gerenciador de segredos. O próprio Fastify serve o frontend compilado e a API na mesma origem. Não cria banco adicional nem worker pago.

O novo modo `--enrichment-batch` do Scout termina quando não há trabalho, após três entidades por padrão ou ao atingir o limite entre entidades. Mantém o lock, cache e tentativas existentes e não reinicializa a fila geral. `.github/workflows/scout.yml` prepara a execução a cada quinze minutos em runner padrão do GitHub. O agendamento depende da variável `OBSERVABR_SCOUT_ENABLED=true`; ela deve ser ativada apenas após o secret e o teste manual.

O lote recebe exclusivamente a conexão writer via secret `OBSERVABR_SCOUT_DATABASE_URL`. A coleta geral e a conciliação financeira pendente não foram ativadas pelo agendamento. O modo não acelera o acesso às fontes nem contorna bloqueios.

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
- Os testes visuais de temas, responsividade e olho foram concluídos na tarefa anterior. Esta entrega não altera o frontend. Os endpoints públicos e o workflow remoto aguardam publicação e execução, portanto ainda não foram validados nesta tarefa.

## Pendências e limites reais
1. Conectar o Render ou concluir o Blueprint pelo painel, com plano gratuito e gasto limitado a zero.
2. Obter o host oficial de Connect → Session pooler, configurar as duas URLs com credenciais distintas e testar TLS e logins reais.
3. Publicar site/API e validar os pontos públicos de entrada.
4. Configurar o secret do Scout, executar um lote real no GitHub e depois ativar o agendamento.
5. Definir backup externo automático e validar sua própria restauração. O backup anterior à importação ainda é local; sua restauração integral já foi testada.
6. Reconciliar o histórico de migrations aplicadas manualmente antes de automatizar db push. O deploy não roda migrations automaticamente.

O gratuito implica suspensão por inatividade, quotas e ausência de SLA. O Render Free pode levar cerca de um minuto para retomar após quinze minutos ocioso. O GitHub pode atrasar agendamentos. A cobertura continua parcial: não foram implementadas novas instituições, cobertura nacional completa, conciliação integral das despesas ou módulos de IA. O caso financeiro anterior permanece pendente na página 2 e o script de reidentificação não foi executado.

Não foi contratado serviço pago nem realizado deploy em outro projeto Supabase. Os projetos pcm-aerocris e radar-vagas não foram alterados. A conclusão operacional exige os quatro primeiros passos acima; ela não está sendo declarada antecipadamente.
