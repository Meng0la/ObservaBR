# Continuidade — ObservaBR
## Identidade animada — 26/11/2026
Olho fornecido integrado ao cabeçalho em `<observa-eye>`, componente nativo reutilizável com SVG e requestAnimationFrame. Contorno fixo, íris e pupila limitadas internamente, retorno suave e cores herdadas dos tokens dos dois temas. Touch e movimento reduzido mantêm a versão estática. Favicon substituído pelo SVG estático fornecido. Implementação, origem dos arquivos e contrato de reutilização descritos em DESIGN.md.

Validação: build e typecheck aprovados; 13 testes de backend aprovados em observabr_test, dois contratos externos ignorados; dois testes Chrome aprovados (regressão da navegação e marca). Dez capturas nas larguras 390–1920, ambos os temas, sem overflow ou erros de console, em .tools/brand-eye. Capturas de 390 e 1440 inspecionadas visualmente. A primeira execução da integração usou nome de role incorreto e falhou na autenticação; repetida com o administrador local correto, passou integralmente. Permanecem os avisos anteriores de chunks grandes e depreciações Fastify/pg. Nenhuma migration ou mudança de contrato de dados nesta tarefa. API e Scout existentes preservados.

Entrega solicitada: commit e push para origin/main. Próximo checkpoint: conferir a marca na instalação local após atualizar a página e aguardar nova tarefa; nenhum deploy solicitado.

Checkpoint de 26/11/2026. Etapa atual é enriquecimento legislativo, correção das votações e API Explorer, autorizada após o envio da Fase 02 ao GitHub. Implementação concluída e validada, incluindo o caso real do PLP 128/2025.

## Git e entrega
Repositório origin em https://github.com/Meng0la/ObservaBR.git, branch main. O envio inicial da Fase 02 foi concluído no commit f9512fa. O commit inicial anterior é 906434c. A implementação desta etapa foi enviada no commit 96ebbb8. A ausência de Git descrita na Fase 01 pertence ao histórico anterior.

## Implementado nesta etapa
- Coletor complementar com registro fechado de recursos da Câmara, validação de identidade e evidência por campo, incluindo SHA-256.
- Cache persistente por recurso e identificador, reutilização de respostas, snapshots públicos com supressões e fila complementar.
- Votação contextualizada com proposição principal, objeto, órgão por extenso, sessão, autoria, placar, votos, partidos, orientações, proposições relacionadas, tramitação, documentos e fontes.
- API Explorer com dados interpretados, resposta coletada e metadados. JSON com expansão, pesquisa, cópia, exportação e vínculos reconhecidos.
- Registros nominais preservam partido, UF e fotografia da resposta oficial. Os filtros usam essa resposta, sem substituição pelo partido atual do cadastro.
- Navegação para proposições, representantes, órgão e sessão. Fichas apenas referenciadas indicam complemento pendente e permitem solicitar coleta.
- Recuperação local de evento, órgão e horário em 1.584 votações a partir das respostas arquivadas. A votação já contextualizada foi preservada.

## Caso real validado
Votação 2520670-66, sessão de 16/12/2025, PLP 128/2025 e destaque 8 sobre o artigo 8º do substitutivo. A descrição oficial informa texto mantido, 286 Sim, 116 Não e total 402. Há 404 registros nominais, incluindo um de Obstrução e um de Artigo 17. A interface mantém as contagens separadas e usa o total proclamado como denominador.
O contexto vem da abertura, das proposições afetadas e dos documentos complementares. O primeiro dos 54 possíveis objetos não foi escolhido como objeto efetivo. Consulte VOTE_AUDIT.md e ENRICHMENT_SOURCES.md.

## Cobertura atual
513 representantes, 100 despesas, 101 proposições distintas, 46 vínculos de autoria, 1.585 votações e 404 registros nominais.
As 55 proposições relacionadas ao caso incluem duas fichas detalhadas e 53 referências com complemento pendente. As 46 autorias anteriores foram preservadas. O restante das votações aguarda contextualização sob demanda ou expansão controlada.
A conciliação das despesas de 204379/2025 continua pendente na página 2. Não executar scripts/reidentify-expenses.ts como parte desta etapa. A cobertura estadual, municipal, eleitoral, judicial e de outras fontes continua dependente de tarefas próprias.

## Arquitetura e segurança
Fastify lê PostgreSQL e recebe solicitações por tipo e ID já indexados. O Scout faz as requisições autorizadas. api_snapshots guarda somente a projeção publicável, enquanto os bytes originais permanecem em source_documents, restritos ao writer. A API de leitura não recebe privilégio para consultar o bruto.
O cache dura 24 horas. Falhas complementares têm nova tentativa em 30 minutos. O mesmo advisory lock serializa o consumidor geral e o complementar. O processamento é idempotente. Revisões do registro e do contexto são preservadas em data_revisions. Documentos iguais não são duplicados integralmente.
O transporte limita cada chamada a 6 MiB. A seleção do Explorer é limitada a 30 documentos e 8 MiB, com aviso. O visualizador limita profundidade e quantidade de nós. URLs arbitrárias são recusadas. Fonte e hashes continuam associados aos campos.
Uma listagem mensal não substitui o registro de votação já contextualizado. A atualização desse registro passa pelo detalhe complementar.
A arquitetura está descrita em architecture/0002-enrichment.md.

## Banco e comandos
Migrations 001_core, 002_observacoes e 003_enrichment aplicadas em observabr e observabr_test. Backup prévio em .tools/pre-enrichment.dump, ignorado pelo Git.
PostgreSQL portátil 17.12 na porta 54672 e Node 24.22.3 em .tools/node-v24.22.3-win-x64. Credenciais em .tools/*.pass permanecem privadas.

Para atualizar uma instalação existente, aplique somente a migration 003 pendente após 001 e 002. Em volume Docker novo, a inicialização aplica todas em ordem. Mantenha DATABASE_URL de leitura na API e escrita no Scout.
- npm ci, npm run build, npm start e npm run worker são os comandos usuais.
- node apps/worker/index.ts --enrichment-once processa uma solicitação complementar disponível.
- node scripts/enrich.ts vote ID processa uma entidade indexada com lock e cache, usando credencial do coletor.
- node scripts/backfill-evidence.ts projeta respostas já armazenadas para o Explorer e preserva datas de origem.
- node scripts/backfill-vote-fields.ts recupera os campos descartados da listagem, sem novo download.
Os dois backfills foram executados nesta etapa. Repetições são idempotentes. A API de validação atual está em http://127.0.0.1:3001. O Scout precisa permanecer em execução para consumir solicitações da interface.

## Testes e resultados
13 testes locais aprovados, com dois contratos externos ignorados no comando padrão. A integração usa exclusivamente observabr_test.
Os contratos externos foram executados separadamente e resultaram em nove testes aprovados, sem ignorados.
TypeScript, build, smoke HTTP e sentinela de segredo passaram. O build contém 20 arquivos e mantém o aviso de chunks acima de 500 kB.
Quatro testes de navegador passaram, incluindo histórico, votação real, exportação, Explorer e a matriz de regressão dos dois temas. O teste específico foi repetido com vinte capturas de contexto e votos em cinco larguras, nos dois temas, sem overflow de página.
Capturas da nova votação e do Explorer estão em .tools/enrichment. A comparação visual e seus limites estão registrados em ENRICHMENT_VALIDATION.md.

## Limitações e retomada
Complementos de outras votações são progressivos. Até quatro fichas de proposições são aprofundadas por votação. Os endpoints complementares homologados retornaram listas sem próximo link. Se a fonte passar a paginá-los, a resposta é registrada como recurso parcial até revisar o contrato, conforme ENRICHMENT_SOURCES.md.
A API Explorer atual atende JSON. Outros formatos e novas instituições precisam de política e contrato próprios. O limite de solicitações públicas é por IP e por instância. Uma operação pública com réplicas exige orçamento global da fila.
A consulta de navegação ao documento codteor=3069283 recebeu HTTP 429. A identificação do caso foi comprovada pelas demais fontes oficiais. Nenhum bloqueio foi contornado.
Próximo checkpoint é conferir o commit enviado no GitHub e aguardar a definição da próxima tarefa. Novos módulos exigem instrução própria.

## Correção operacional da porta 3001
A captura do usuário mostrou 404 em /api/votes/2589598-15. A votação já existia no banco, mas a instância antiga na porta 3001 ainda não registrava a rota complementar. A instância foi reiniciada com a API atual na mesma porta. O endpoint e a página foram verificados no Chrome sem erros HTTP da API.
O contexto dessa votação foi coletado por scripts/enrich.ts usando os recursos oficiais homologados, com estado done. O smoke HTTP passou a exigir a rota complementar, inclusive em banco vazio, para detectar uma API antiga. Captura de verificação em .tools/enrichment/correcao-3001.png.

## Fila de enriquecimento em operação local
A tela queued indicava uma solicitação persistida sem consumidor ativo. O Scout foi iniciado em modo --enrichment-only, que atende complementos e permanece aguardando novas solicitações. O trabalho 1703883-83 chegou ao estado done. Esse modo utiliza o mesmo lock, cache e tratamento de falhas do worker.
A interface traduz o estado para português, desabilita novo pedido enquanto a solicitação está pendente e consulta o andamento a cada três segundos na aba Contexto. Ao sair da página, cancela a atualização. O processamento exige que o Scout continue ativo. Comando local com DATABASE_URL de escrita e configuração de rede apropriada: node apps/worker/index.ts --enrichment-only.
