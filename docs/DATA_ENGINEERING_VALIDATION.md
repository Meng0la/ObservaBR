# Engenharia de dados — validação em andamento

Etapa iniciada em 26/11/2026 na branch data-engineering-controlled-ingestion. Produção preservada; não houve conciliação remota, deploy desta branch ou ativação de coleta geral. Este relatório é incremental e não declara a etapa inteira concluída.

## Conciliação de despesas: validada em isolamento
O erro histórico da fila é `Chaves ambíguas na página da Câmara`, página 2, deputado 204379/2025. Os bytes atuais da página 1 coincidem com a evidência arquivada (SHA-256 45e6d8b1c8211648e853db40171eb4a3b0231717bc6d5a45ad0b1b95f5a5fcc5). A página 2 tem SHA-256 782311775ed762bc3d254f4faca0f85b4a61594ae0c562a41847183b9a133d1e. Ambas possuem 100 linhas e hoje passam no parser versionado; não foi atribuída ao parser atual uma falha que ele não reproduz.

Foi reproduzida a falha operacional: os 100 IDs já publicados diferem dos calculados pelo parser atual para os mesmos ponteiros e bytes. Retomar sem conciliar produziu 200 registros para apenas 100 posições de evidência e duplicou o total de -68.934,10 para -137.868,20. Essa reprodução ocorreu somente numa cópia descartável, observabr_engineering, preservada para inspeção.

Na página 2 há três grupos de códigos documentais repetidos, incluindo registros sem código. Entre os atributos variáveis estão competência, número documental, fornecedor, data e valores. Coincidência de código não é duplicidade comprovada. O algoritmo composto atual já distingue esses casos; a correção é migrar o acervo antigo com evidência e impedir publicação silenciosa de identidades incompatíveis.

O novo script é dry-run por padrão e gera plano imutável por hash. Valida SHA-256, ponteiro, título, competência, data, fornecedor publicável, documento e componentes NUMERIC. Aplicação exige --apply e --expected-plan; destinos já ocupados abortam sem excluir linhas. O plano de 100 mudanças tem SHA-256 57d97ffbb63c1f966e821407a342325679cf3b8fdaf50beb7248327691ace4cf. Aplicação remota também exige --allow-remote e autorização operacional do mantenedor.

Na cópia limpa observabr_engineering_validated: 100 registros e total -68.934,10 preservados; criados 100 aliases; histórico anterior mantido sem reescrever seu JSON. O novo ID recebe evento de conciliação com o snapshot anterior. Após coletar as duas páginas: 200 registros, total -106.778,23. Repetir as duas páginas preservou ambos os valores. Dry-run posterior mostrou zero mudanças. API resolve URLs antigas pelos aliases; novo schema ainda não foi aplicado em produção.

Dois testes de regressão aprovados inicialmente: atributos que distinguem lançamentos com código repetido; dry-run, plano obrigatório, preservação de valor/histórico, alias pelo ponto de entrada HTTP e bloqueio de republicação incompatível. Resultados finais da suíte serão registrados após a auditoria das filas.

## Auditoria inicial da fila
Snapshot remoto somente de leitura: 2.616 tarefas; 1.581 nominais aguardando com prioridade 15, 513 despesas e 513 proposições com prioridade 20. A ordenação fixa permite que os nominais atrasem os demais tipos. Há uma despesa falha na página 2 e atualizações gerais vencidas. O worker contínuo drena todas as páginas de uma tarefa, sem orçamento por página, e não tem dead-letter. O agendamento complementar existente permanece separado e inalterado.

## Medição inicial remota
Banco: 21.124.787 bytes; 14 conexões observadas incluindo serviços internos/inspeção, sem atribuir todas à aplicação. records: 2.433.024 bytes de tabela e 3.244.032 de índices. data_revisions: 2.039.808 + 81.920 bytes. collection_jobs: 540.672 + 212.992 bytes. source_documents: 286.720 + 16.384 bytes físicos. Essas medições não são uma taxa de crescimento; falta janela temporal para isso.

## Piloto da fila geral — isolamento
Cinco páginas e 448 registros; total API -199.256,02, preservado sem alteração. Ciclo completo observou/validou/publicou 448 posições; ciclo iniciado no antigo checkpoint foi marcado partial (248 posições), sem afirmar cobertura integral. Dois lotes do ciclo completo: três páginas/143.898 bytes/3,790516 s e duas páginas/72.716 bytes/2,313503 s. Workflow apenas manual; fairness, retomada, limite de tarefas, quarentena, Retry-After e dead-letter têm testes. Um diagnóstico inicial comparou fornecedor bruto com versão suprimida e interrompeu o piloto; corrigido para comparar publicResponse e retomado apenas na cópia isolada. Mensagens de diagnóstico passaram a apresentar apenas nomes de campos, preservando a supressão de identificadores pessoais.

Arquivo anual oficial 2025: 170.615 linhas, 5.998.720 bytes ZIP e 62.723.068 CSV; CRC e SHA verificados. No recorte 204379/2025 há 314 linhas e 384.353,42, sem negativos. API coletada tem 448 linhas, 322 negativas, -199.256,02. Dos lançamentos API, 282 possuem código documental encontrado nesse recorte anual. Não equivale a match unívoco de lançamento. A documentação confirma ideCadastro como o ID da API e avisa que documento pode se repetir. Divergência preservada: nenhum sinal invertido nem registro excluído. Referências oficiais em DATA_SOURCES.md.

## Lotes, cobertura e limites

Novo consumidor processa uma página por claim, com justiça persistente por tipo; testes demonstram despesa e proposição atendidas mesmo com backlog nominal de prioridade superior. Recupera jobs running após obter o mesmo advisory lock 6211501; Session pooler 5432 mantém a sessão, Transaction pooler 6543 é recusado. Workflow collection.yml é manual e compartilha concurrency scout-production, sem modificar scout.yml. Limites validados antes de seed ou conexão; pedidos de busca são preparados em até cinco por lote quando há capacidade. Fanout dos produtores reserva até 200 posições por página. Timeout externo encerra o processo; SIGTERM termina após a página atômica corrente. Uma interrupção forçada mantém recibos e permite recuperar o checkpoint.

Retry exponencial com jitter e Retry-After, até max_attempts; erro de normalização preserva bytes em quarentena. Não há retorno automático de dead/quarantined à fila. O ponto de entrada contínuo geral usa o mesmo consumidor limitado e justo da CLI, em vez de drenar páginas sem orçamento. Os modos complementares seguem separados; nenhum consumidor contínuo geral foi iniciado em produção. A atualização incremental é revalidação periódica por upsert e recibo, sem afirmar ETag/CDC não implementado. Mudança de chave externa permanece sujeita à conciliação. Ausência em ciclo completo vira observação de ausência, não exclusão ou acusação; teste preserva o registro. Ciclo parcial não atesta remoção. Não há rotina de purge de evidências/revisões.

OpenAPI atual confirma paginação nos quatro recursos de listagem; votos nominais não têm pagina/itens. Próximo link nominal inesperado exige revisão do contrato, sem fabricar parâmetros. Resposta vazia conserva o significado institucional; não significa ausência de atividade. Páginas finais contíguas provam apenas fim da listagem recebida, não total independente da instituição. Retotalizações e páginas mutáveis entre chamadas continuam riscos de snapshot da fonte.

## Armazenamento, backup e migrations

POC executada sobre 170.615 linhas do arquivo oficial: igualdade de count e soma exata 214.501.878,24 nos quatro formatos. CSV projetado 13.046.084 B, JSON 21.408.053 B, PostgreSQL com PK 20.316.160 B, Parquet/Zstandard 875.620 B. Scans medianos locais 110,18/315,06/69,38/7,96 ms. Limites da comparação e reproducibilidade em STORAGE_STRATEGY.md e STORAGE_POC_RESULTS.json. Nenhum arquivamento frio remoto.

Backup AES-GCM com login dedicado: round-trip autenticado e restauração em outro banco PostgreSQL passaram; 3.110 registros, 2.094 revisões, 100 aliases, zero hashes brutos inválidos. Chave errada e corrupção são rejeitadas nos testes. Procedimento em BACKUP_RECOVERY.md. Destino privado externo e agendamento permanecem pendentes; não chamar o ensaio local de backup externo ativo.

Schema histórico local/remoto: sete componentes do catálogo iguais, incluindo permissões e RLS. Registradas somente duas entradas ausentes de baseline; cinco versões históricas alinhadas, sem reset/reaplicação. Migration nova validada em banco vazio com 17 tabelas RLS; reader sem bruto, writer com aliases e backup com leitura própria. Detalhes em MIGRATION_RECONCILIATION.md. Novo schema não aplicado em produção.

## Métricas e consultas

data-metrics.ts exporta snapshots privados com tamanho de tabelas/índices, média de JSONB, conexões, fila por tipo/estado, idade por tipo, ciclos completos/parciais, quarentena e taxas dos lotes em 24 h. Alertas configuráveis em 70/85/95; limite padrão de banco 500 milhões de bytes e fila 10 mil. Crescimento só é calculado entre snapshots datados e não deve ser projetado mensalmente a partir de minutos. Métricas de requests/bytes de run interrompido podem ser incompletas; recibos persistentes continuam a evidência da publicação. Egress faturado e quota de conexões precisam do painel do provedor, sem inferir tráfego a partir de tamanho de tabela.

EXPLAIN remoto anterior: filtro de despesas por owner usa records_owner e top-N sort, execução 2,85 ms; FTS usa records_fts, execução 0,673 ms com planejamento frio 51,449 ms. São amostras, não p95. Consulta local do novo consumidor usou collection_ready em Bitmap Index Scan; amostra de filtro sem elegíveis mediu 2,235 ms sem índice/1,327 ms com índice. Não atribuir causalidade/performance sustentada a essa única comparação aquecida. Não foram removidos índices nem introduzido particionamento. Normalizar entidades/relações progressivamente após comprovar benefício.

## Qualidade e produção

Preservado caso 2520670-66: 286 Sim + 116 Não = 402 no placar; mais uma Obstrução e um Artigo 17 = 404 IDs nominais distintos. Não houve exclusão de duplicatas para forçar igualdade. Ausência de duplicata por ID não exclui retificação fora do snapshot; mantenha horários, revisão e fonte. VOTE_AUDIT.md registra fontes por campo. Frequência e Atividade está somente no ROADMAP, sem horas ou ausências inferidas.

Smoke HTTPS público aprovado nesta etapa para /api/health, resumo, filtros reais, CSV, placar 402/404, evidências e entradas inválidas. Sem deploy desta branch. Render permanece com healthcheck TCP; render.yaml já recomenda /api/health, cujo retorno HTTPS foi verificado. Não foi alterado o serviço nem criado recurso duplicado; adoção do healthcheck no serviço existente exige configuração operacional, não novo Blueprint. Não foram criados pings de manutenção de atividade.

Inspeção com a skill Render Monitor confirmou plano Free, not_suspended e deploy anterior live no commit 8124696; healthCheckPath vazio. Consulta de logs com nível error não retornou entradas. Isso é um snapshot de monitoramento, não garantia de disponibilidade ou ausência de erro fora da janela.

## Validação e pendências operacionais

Suíte local: 26 testes aprovados, dois contratos externos ignorados no comando padrão, nenhuma falha após serializar os arquivos que compartilham banco/lock. Contratos externos executados separadamente: nove testes aprovados, sem ignorados. A primeira execução paralela teve uma disputa legítima de lock entre testes, corrigida na configuração do runner; o teste de exclusão mútua permanece. Typecheck inclui scripts e passou; build passou, preservando aviso anterior de chunks maiores que 500 kB e depreciações Fastify/pg. Verificação final de branch será registrada no próximo checkpoint.

Após unificar o consumidor contínuo geral com a CLI, sete testes de fila e worker passaram novamente e typecheck passou. Build repetido com segredo sentinela: ausente nos 20 arquivos publicados. Nenhuma alteração visual, biblioteca de produção ou tecnologia de runtime adicionada. DuckDB Node API 2.0.1-r.1 instalado apenas na pasta privada da POC. Auditoria das quatro referências e decisões de licença em REFERENCE_ARCHITECTURES.md.

Ainda não concluídos: importação anual publicável (divergência API/CSV); aprovação e aplicação do novo schema/conciliação remota; autorização para agendamento geral. Backup externo ativo e restauração periódica foram adiados explicitamente pelo mantenedor, que escolheu manter apenas o procedimento preparado. Não declarar esses serviços ativos nem a importação anual concluída. Os demais recursos estão implementados e validados em isolamento conforme as evidências acima.

Entrega de revisão: commit c3ebee2 enviado, PR #1 em rascunho, sem merge ou deploy. CI aprovada: https://github.com/Meng0la/ObservaBR/actions/runs/45862842185. Jobs secrets, CodeQL e verify passaram, incluindo banco isolado, testes de navegador, Docker, migrations e API reader. O ajuste posterior acrescenta ao relatório de métricas as razões explícitas de falhas e registros/segundo, sem alterar o consumidor ou os contratos HTTP.
