# P2 — classificação persistente e auditoria do consumidor

27/11/2026, PR #1. Código e migration validados somente em PostgreSQL local; nenhuma operação em produção.

## Causa e correção

A reserva usava status=done para reconhecer refresh. A primeira página mudava a tarefa para queued e as seguintes perdiam a reserva. Agora collection_cycles.mode guarda backfill ou refresh desde a criação do ciclo. O ciclo ativo fornece a classificação ao seletor; status queued/running/failed não altera o modo. Um ciclo novo usa a conclusão anterior como referência, inclusive done legado sem histórico de ciclos. Essa inferência acontece antes do claim, nunca reclassifica um ciclo em andamento.

O contador persistente served continua por categoria/tipo. Cada quinta oportunidade prefere refresh; as outras quatro preferem backfill, com fallback quando a classe preferida não tem trabalho elegível. Backfill mantém a ordem de anos autorizada. Refresh ordena pela última oportunidade recebida, para ciclos antigos também avançarem diante de refresh recente contínuo. A garantia depende de elegibilidade: backoff, capacidade, filtros operacionais, dead-letter ou quarentena podem impedir uma tarefa de concorrer. Não é um SLA.

Na última página, conclusão do ciclo, recibos, observações, limpeza do ponteiro e próxima data de atualização são atômicos. O modo permanece no histórico e só um novo ciclo recebe nova classificação. A resposta /api/coverage inclui cycle_mode. A correção de collection_requests permanece: falha temporária aguarda retry, terminal é failed e sucesso fecha o pedido.

## Migration e legado

20261127110000_persistent_cycle_mode adiciona mode obrigatório e restrito aos dois valores. Ciclos antigos com predecessor comprovadamente concluído são refresh; casos sem prova são backfill conservador, sem inferir o passado a partir do status atual da tarefa. Pode ser necessária revisão de ciclos antigos cuja origem já foi perdida; a migration não afirma reconstruir informação que não existe. Não houve aplicação remota das migrations de engenharia, portanto o acervo de produção não recebeu essa inferência.

Trigger impede mudar modo ou job_key de um ciclo existente. Correção administrativa de uma classificação ambígua exige procedimento revisado que preserve o ciclo antigo e inicie outro; não desligar o trigger ou sobrescrever histórico por conveniência. A função não usa SECURITY DEFINER, tem search_path fixo e EXECUTE público revogado. RLS/grants existentes continuam protegendo os dados.

## Auditoria dos mecanismos relacionados

| Área | Verificação e resultado |
| --- | --- |
| Paginação e retry | mode fica no mesmo cycle_id enquanto page avança, status volta a queued ou falha temporária produz failed. Retry-After, tentativas e requests foram preservados. |
| Interrupção/reinicialização | Recuperação só muda running para queued depois do lock comum; não apaga ciclo ou modo. Regressão fecha uma conexão PostgreSQL e retoma em backend diferente. |
| Justiça entre categorias | last_served_at continua compartilhado e persistente. O contador e o claim agora são atualizados na mesma transação; falha no claim não gasta a oportunidade reservada. |
| Justiça entre refreshes | Ordenar todos os refreshes pelo ano também poderia adiar os antigos. A ordenação por updated_at distribui oportunidades entre ciclos elegíveis; os anos continuam ordenando o backfill. |
| Concorrência | Advisory lock 6211501 de sessão preservado; Session pooler 5432 continua exigido nos pontos de entrada remotos. Outro consumidor é rejeitado antes de alterar o ciclo. Os workflows mantêm o mesmo grupo de concorrência; o cron complementar não inicia o geral. |
| Persistência complementar | Persist sem cycle_id podia encerrar/limpar uma tarefa com ciclo geral ativo. Agora conserva seu checkpoint e pedido; pode persistir a evidência/registro complementar sem consumir esse ciclo. |
| Identidade do checkpoint | Persist verifica que o ciclo pertence à tarefa e está ativo antes de publicar uma nova página. Um checkpoint inconsistente é isolado em quarentena pelo seletor, sem impedir os demais trabalhos. |
| Encerramento/cadência | A atualização 1/7/30 dias estava fora da transação de persist; falha após commit poderia marcar como quarentena um trabalho concluído ou perder a cadência. Agora integra a mesma transação da última página. |
| Repetição de recibo | Repetir a mesma página/hash já confirmada é no-op, inclusive depois do encerramento; mudar bytes no mesmo recibo continua bloqueado. |
| Cobertura e falhas terminais | Ciclo não concluído permanece sem declaração de cobertura integral. Dead/quarantined retêm classificação e evidências para revisão; não são retomados automaticamente. Ausência observada não apaga registro. |

Esta auditoria cobre as transições de estado dos consumidores existentes. Não homologa novas fontes, não remove limites de armazenamento/transportes e não promete ausência de outros defeitos. O bloqueio conservador de produtores próximo ao teto da fila continua valendo também para refresh; não se ultrapassa capacidade para cumprir a reserva.

## Regressões executadas

- Refresh histórico de três páginas, simultâneo com backfill recente que sempre anuncia próxima página: oportunidades 1, 6, 11 e 16 atendem o refresh, incluindo a tentativa falha da página 2. O backfill avança nas demais.
- Troca real de conexão/backend, recuperação de tarefa running, budget/stop e retry com Retry-After preservam o mesmo ciclo/mode. O pedido segue running e termina done na conclusão.
- Dois refreshes, antigo e recente, concluem enquanto o backfill recente continua incompleto; ambos recebem a reserva sem starvation entre anos.
- Complemento sem ciclo não limpa o ciclo ativo; consumidor concorrente é rejeitado; ciclo de outra tarefa não é aceito; checkpoint inconsistente não bloqueia o lote inteiro.
- Falha injetada no claim desfaz ciclo/estado e preserva o contador de oportunidades.
- Migration em banco descartável comprova inferência conservadora do legado, imutabilidade, escrita legítima do writer, leitura do modo pelo reader e bruto inacessível ao reader.

Fixtures pertencem apenas aos testes. Não foi efetuada coleta de dados reais nem modificação de valores/IDs nesta correção. Os testes anteriores do P2 de collection_requests continuam na suíte.

Resultado local: 40 testes aprovados e dois contratos externos opcionais ignorados; typecheck e build aprovados. A migration em banco vazio/legado de teste e os papéis reader/writer passaram. Mantidos avisos já conhecidos de chunks grandes e depreciações Fastify/pg. O teste de stop é cooperativo e o de restart troca o backend real; não foi simulado desligamento físico da máquina.

Entrega no commit 82ff307, mesma branch do PR #1. CI aprovada em https://github.com/Meng0la/ObservaBR/actions/runs/45982255712: verify (testes, navegador, Docker, migrations e API reader), secrets e CodeQL. O apontamento P2 foi marcado como resolvido após a validação. O checkpoint posterior somente documenta os resultados, sem alterar o código testado. Nenhum merge, deploy ou migration em produção.

## Ordem de publicação e rollback

Após autorização: instalar as migrations de engenharia anteriores e depois 20261127110000_persistent_cycle_mode; publicar o runtime novo; validar modo, reader, reserva, recuperação e requests. Este código requer a coluna mode. Não houve merge, deploy ou migration de produção; cron geral permanece inativo.

Rollback exige interromper o consumidor geral antes de publicar runtime anterior, pois ele não preserva a reserva por ciclo. Manter schema aditivo, trigger, recibos, modos e evidências; não executar reset/DROP nem apagar ciclos. Antes de reiniciar qualquer consumidor, preparar em PR autorizado uma versão compatível com mode explícito: binários anteriores não preenchem a coluna NOT NULL e não podem criar ciclos. Não enfraquecer a constraint com um default silencioso, pois isso reclassificaria refresh como backfill. Não reverter para runtime sem suporte aos aliases se IDs financeiros já tiverem sido conciliados.

Impedir também que um worker complementar com persist antigo opere sobre ciclos ativos durante o rollback, para não limpar seus checkpoints. Retomar somente consumidores compatíveis com a preservação do ciclo ativo, após revisão/autorização.
