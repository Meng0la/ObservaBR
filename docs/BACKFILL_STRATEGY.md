# Backfill e sincronização — 26/11/2026

Extensão da fase de engenharia de dados, implementada na branch de revisão. Supabase de produção foi consultado somente para baseline; não houve deploy, conciliação remota, seed remoto ou ativação de cron geral. Backup externo permanece adiado por decisão do mantenedor.

## Ordem e descoberta controlada

Prioridade: 2026, 2025, 2023, 2024. Anos anteriores são acrescentados em ordem decrescente somente com --earliest explícito, até 2008. Uma mudança de ano permite inserir o novo ano corrente à frente dessa sequência. O planejador não considera uma fila grande prova de cobertura: identifica chaves ausentes, prepara no máximo 25 tarefas por padrão e nunca reinicia páginas ou falhas existentes.

`node scripts/backfill.ts --limit=25` é dry-run. Gera plano privado por SHA-256 com anos, escopos ausentes, quantidade selecionada e diferida. `--apply --expected-plan=HASH` prepara apenas as tarefas revisadas, sob o lock 6211501. Remoto exige também --allow-remote e autorização operacional; a flag não substitui a autorização. Não há reset de dados ou checkpoints. Seed é bloqueado acima de 85% do orçamento de banco e limitado pelo teto da fila.

Para consumir os trabalhos aprovados: `node scripts/collect-batch.ts --years=2026,2025,2023,2024 --max-tasks=3 --max-seconds=180`. Reutiliza os limites de bytes/requisições, capacidade, retry, dead-letter e quarentena da fase. O workflow collection.yml continua exclusivamente manual, agora aceita anos ordenados e usa 2026 como ano único padrão. scout.yml permanece complementar e inalterado. O cron geral continua sujeito à aprovação específica.

O ponto de entrada contínuo geral usa essa mesma política de anos por padrão; SCOUT_COLLECTION_YEARS permite uma lista explícita, e COLLECTION_YEAR preserva o recorte único quando configurado. Os modos --enrichment-only/--enrichment-batch não iniciam backfill. Nenhum desses processos gerais foi ativado na infraestrutura publicada.

A descoberta considera cadastros por intervalo, despesas e proposições por representante/ano, votações por mês e nominais descobertos a partir das votações. Não cria automaticamente todas as milhares de tarefas. O plano usa o cadastro já indexado como conjunto inicial; não o trata como relação completa de mandatos históricos. Cada nova página de cadastro pode descobrir representantes e preparar as tarefas correspondentes, dentro do teto de fanout existente. Repetir o dry-run após completar o cadastro amplia a descoberta de escopos ausentes.

## Cadastro histórico não é cadastro atual

O OpenAPI oficial informa que /deputados sem parâmetro temporal retorna os representantes em exercício no momento; com dataInicio/dataFim, retorna quem esteve em exercício no intervalo. O modo de backfill usa `roster: period`, com chave própria e datas explícitas. O modo atual conserva a consulta corrente. Não substituir um pelo outro silenciosamente.

Na página real de 2026 houve 15 pares com mesmo ID e diferença apenas em siglaPartido. O parser preserva todas as posições de evidência e normaliza 85 identidades para 100 linhas. Conta essas variantes separadamente de duplicatas exatas. Um cadastro anual não determina a filiação atual: perfis já existentes não são sobrescritos pelo modo histórico; novos perfis históricos têm partido atual desconhecido. Divergências adicionais de identidade continuam em quarentena. Roster não é folha de frequência nem prova de horas trabalhadas.

## Atualização após e durante a carga inicial

O contador persistente por tipo reserva cada quinta oportunidade para tarefas concluídas cujo prazo de revalidação venceu; as outras quatro priorizam backfill na ordem anual. Se uma classe não tiver trabalho elegível, a outra usa a capacidade. O contador persiste entre lotes de uma página, e a justiça entre tipos continua pela última oportunidade atendida. Assim uma fila histórica extensa não bloqueia indefinidamente revalidações e os nominais não monopolizam os demais tipos.

A ordem anual vale dentro das oportunidades de cada tipo; não é uma barreira que paralisa todos os outros tipos até encerrar um ano. A reserva de sincronização pode atender um escopo antigo vencido enquanto há backfill recente. Isso é deliberado para preservar atualização e justiça.

Cadência do consumidor geral: ano corrente e votações dos dois meses mais recentes, um dia; ano anterior e meses antigos do ano corrente, sete dias; históricos anteriores, trinta dias. Toda consulta é uma nova observação, com upsert, bytes e hash, sem duplicar revisões quando valores não mudam. A atualização não se limita ao maior ID/data: reaprecia períodos antigos, pois a fonte pode retificar ou publicar documentos tardiamente. Não há CDC/ETag alegado sem implementação.

Somente um ciclo de páginas contíguas a partir de 1 pode registrar escopo percorrido. Ausências observadas em ciclo completo preservam o registro anterior e sua evidência; não equivalem a exclusão confirmada. Mudança de chave ou divergência entre arquivos/API exige conciliação. Nenhuma inversão heurística de valores financeiros foi implementada.

## Datas, cobertura e ponto de entrada

`GET /api/coverage?kind=expense&year=2026&by=period` expõe indicadores por representative, source, category ou period, com paginação de 100 itens e filtros validados. `owner=204379` permite examinar um representante. A leitura usa transação repeatable read/read only; não dispara coleta. A nova rota requer as migrations da branch, ainda locais.

O contrato distingue:

- Data do acontecimento: emissão do documento para despesa, apresentação para proposição, sessão para votação. No nominal, a data da sessão vem da votação vinculada; o horário de registro do voto continua separado no registro original. Datas ausentes permanecem nulas.
- Competência financeira: ano e mês oficiais da despesa; não deriva da emissão, coleta ou verificação.
- Coleta e última verificação: collected_at e verified_at, separados dos intervalos solicitados e das datas dos acontecimentos.
- Período solicitado: scope_from/scope_to capturados ao abrir o ciclo. Os ciclos antigos sem esse metadado não recebem datas presumidas.
- Escopo efetivamente percorrido: intervalo do último ciclo completo e seu as-of. Um nominal completo cobre apenas a votação identificada. Uma listagem completa de proposições por autor não cobre todas as proposições da Câmara.
- Estado: pending, partial, stale, source_failure, quarantined, complete_as_of_collection, entity_complete_as_of_collection, complete_period_unknown ou future_scope. A cobertura anterior não é apagada quando uma atualização começa.

Totais publicados incluem observações históricas conservadas no índice, não apenas o último retorno. Indicadores de linhas observadas/validadas/publicadas dos ciclos ficam separados. `institutionalTotal` e `coveragePercent` são null enquanto não existir denominador homologado e comparável. O total de pessoas indexadas não é prova da composição histórica de uma legislatura. Não se apresenta ausência de registros como ausência de gastos ou atividades.

Os limites de período do ciclo são o horizonte operacional de cobertura no início da coleta, limitado ao as-of do ano corrente; a URL exata da consulta continua na evidência. Um filtro anual da API não comprova acontecimentos futuros. O CSV dos registros passa a exportar collected_at separadamente de date e verified_at; mudança aditiva de contrato, sem preencher datas ausentes.

## Arquivos completos: decisão baseada em medidas

[Documentação oficial de arquivos](https://dadosabertos.camara.leg.br/swagger/api.html) e [campos CEAP](https://dadosabertos.camara.leg.br/howtouse/2023-12-26-dados-ceap.html) consultadas. O arquivo anual de 2026 foi baixado e validado em staging privado: 4.802.417 bytes ZIP, 48.101.007 CSV, 128.906 linhas, 565 IDs de parlamentar não vazios e competências janeiro–novembro. Hash ZIP 9e8f716d5f9c2229023db3899401e6bde9f2d2f63d2ad522cad812277f177b6c. CRC, tamanho de expansão e estrutura CSV verificados. Metadados em BACKFILL_METRICS.json; CPF e dados brutos não foram versionados.

Se a API demandasse páginas de 100 itens para esse mesmo volume, seriam pelo menos 1.290 páginas, antes de distribuição por parlamentar/retries. Isso é comparação aritmética de estratégia, não número medido de chamadas para cobrir a API: os dois conjuntos ainda não estão homologados como equivalentes. Um arquivo único é preferível para bootstrap histórico após validar identidade, composição dos valores e semântica; API fica para janelas recentes, detalhe e revisão.

A prova anterior com 2025 mediu CSV/JSON/PostgreSQL/Parquet-Zstandard em 170.615 linhas. A divergência de sinais e contagens entre API e arquivo foi preservada. A homologação publicável ainda depende de mapping de campos/chaves, evidência de linha ligada ao hash ZIP/CSV, comparação de totais e diferenças justificadas, staging idempotente e aprovação de promoção. Não colocar o CSV em api_snapshots como se fosse resposta JSON da API, nem associar hash do arquivo a uma URL não coletada. Arquivo completo em staging não é cobertura publicada de 128.906 despesas.

## Métricas reais antes/depois

Baseline remoto confirmado no PostgreSQL: 513 representantes, 100 despesas de um parlamentar, 160 registros de proposições (109 sem data), 1.585 votações, 404 nominais; fila 2.608 queued, sete done e uma falha financeira na página 2. Essa produção permanece inalterada.

O piloto foi executado em observabr_backfill_validation, cópia isolada desse acervo, com quatro páginas publicadas após revisão do contrato do cadastro:

| Indicador no banco isolado | Antes | Depois |
| --- | ---: | ---: |
| Pessoas indexadas, incluindo históricas | 513 | 515 |
| Despesas | 100 | 200 |
| Despesas de 2026 | 0 | 100 |
| Registros de proposições | 160 | 173 |
| Proposições de 2026 coletadas no piloto | 0 | 13 |
| Proposições sem data | 109 | 109 |
| Votações | 1.585 | 1.685 |
| Votações de novembro/2026 coletadas no piloto | 0 | 100 |
| Nominais | 404 | 404 |

O recorte de despesas de 2026 observa competências janeiro–abril, mas documentos emitidos entre 11/01 e 22/05; oito datas de emissão estão ausentes. Isso demonstra por que emissão e competência não devem ser confundidas. O escopo financeiro segue parcial, página 2 pendente, sem intervalo completo certificado. As 13 proposições de um único autor completaram a listagem de 2026 recebida naquele momento; não representam a Câmara inteira. As 109 datas antigas não foram preenchidas por suposição; dependem de detalhes ou arquivo homologado.

O cadastro datado teve 100 posições/85 IDs na página, com dois novos IDs históricos no índice. A soma das quatro páginas publicadas foi 313 posições observadas/validadas e 298 identidades publicadas por página. Também se preservou a primeira resposta rejeitada, sem publicá-la. Houve uma parada de orçamento durante uma tentativa sem o proxy configurado, retomada sem perder checkpoint. Consumo total do ensaio, incluindo esses eventos: sete tentativas de transporte, cinco respostas recebidas, 169.945 bytes, um evento de quarentena e um budget stop. As quatro páginas válidas usaram 134.609 bytes. Não se omitem falhas do piloto.

Banco isolado: 16.881.331 → 18.200.243 bytes; diferença inclui registros, evidências, índices e filas. O clone restaurado pode ocupar menos espaço que o remoto por reorganização física; não comparar diretamente esses tamanhos como crescimento de produção. A fila local terminou com 2.712 queued, sete done, uma failed e uma quarantined, incluindo fanout de 100 votações e representantes descobertos. O backfill é limitado, não instantâneo.

Consultas reais, grupos de cobertura, datas e contadores de execução estão em BACKFILL_METRICS.json. Testes cobrem ordem dos anos, seed por hash/sem reset, reserva de atualização entre lotes, filiação preservada, variantes documentadas e rota HTTP. A publicação coordenada da fase, conciliação remota e cron geral continuam sujeitos à autorização pendente.

Validação local final: 33 testes aprovados, dois contratos externos opcionais ignorados no comando padrão. Os pontos de entrada de 2026 foram exercitados no piloto real; não se atribui execução à suíte live que não foi repetida nesta extensão. Typecheck incluindo scripts e build passaram; sentinela ausente nos 20 arquivos publicados. Após adicionar a política de anos ao worker contínuo, seus dois testes foram repetidos com sucesso. Mantidos avisos anteriores de chunks grandes e depreciações Fastify/pg. A primeira versão da consulta de cobertura teve erro de alias SQL reservado, corrigido e coberto pelo teste HTTP com dados, competência e emissão em meses distintos.

Todas as migrations canônicas passaram novamente em banco vazio, incluindo a nova: 17 tabelas com RLS, reader sem bruto e com leitura dos campos de escopo. EXPLAIN ANALYZE local sobre o consumidor financeiro/2025 usou jobs_period e mediu 0,152 ms nessa amostra; não é p95 nem previsão de produção. Baseline remoto reconsultado ao final: mesmas contagens e estados, sem schema de engenharia aplicado.

Entrega: commit 99e697e no PR #1 em rascunho. [CI aprovada](https://github.com/Meng0la/ObservaBR/actions/runs/45867426049): secrets, CodeQL e verify, incluindo navegador, Docker, migrations e API reader. Nenhum merge/deploy ou cron geral ativado. O checkpoint posterior é apenas documental e não altera o código validado.

## Publicação futura e rollback

Após autorização explícita: conferir backup/checkpoint e catálogo; aplicar 20261126160503_data_engineering e 20261126171500_backfill_coverage na ordem; publicar o runtime validado; testar reader, aliases e /api/coverage; só então repetir dry-run e considerar conciliação financeira/seed revisado. Ativação de cron geral continua sendo uma decisão separada. O schema novo deve preceder o runtime que o consulta.

Se houver falha após publicação, interromper o consumidor geral e novas execuções manuais antes de trocar o runtime; preservar o lock e os checkpoints. Não entregar tarefas roster:period ao consumidor antigo, que não entende esse contrato. Preparar rollback em branch/PR próprio, com autorização, usando código compatível com os aliases já existentes. O commit 7033707 é referência de código anterior à extensão, mas precisa de build/deploy e verificação próprios; não é um artefato Render previamente publicado.

Manter migrations aditivas, RLS, evidências, observações e histórico; não usar reset, DROP ou exclusão em massa como rollback. Se IDs financeiros já tiverem sido conciliados, o runtime anterior à implementação de aliases (como o antigo deploy 8124696) não é rollback seguro, pois quebraria URLs antigas. Valores e identidades exigem plano de reconciliação inversa revisado, não UPDATE genérico. Restaurar backup somente em destino isolado para comparação antes de qualquer recuperação operacional autorizada.
