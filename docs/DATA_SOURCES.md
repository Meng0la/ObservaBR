# Cobertura de dados
Extensão de backfill: arquivo CEAP 2026 completo avaliado em staging; API de 2026 testada em páginas limitadas de despesas, proposições, votações e cadastro temporal. /deputados com dataInicio/dataFim pode repetir o mesmo ID com partidos distintos; preservar posições e não inferir partido atual a partir do período. Competência financeira e emissão documental são eixos diferentes. Métricas antes/depois são locais e não alteram a cobertura publicada no Supabase. Consulte BACKFILL_STRATEGY.md.
Engenharia de dados em andamento: duas páginas oficiais de despesas 204379/2025 foram arquivadas em diretório privado local e comparadas à evidência persistida. Código documental repetido não foi interpretado como despesa duplicada. Os 100 IDs legados exigem conciliação antes da retomada; nenhuma alteração remota foi aplicada. Consulte DATA_ENGINEERING_VALIDATION.md.

A fonte implementada neste corte é a [API de Dados Abertos da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html). A página de cobertura e o estado da fila mostram o que já entrou no banco local. Consulte CAMARA.md para contratos e limites. Uma votação sem votos nominais disponíveis não produz votos individuais.

| Instituição ou conjunto | Estado de integração |
|---|---|
| Câmara dos Deputados | Cadastro, despesas CEAP, proposições por autor, votações e registros nominais. Escopo temporal do trabalho registrado na fila. |
| Senado, TSE, LexML, DOU | Homologação pendente |
| Portal da Transparência | Homologação e credencial de API pendentes |
| PNCP, Tesouro, Obrasgov, SIOP, Transferegov | Homologação pendente |
| Assembleias, câmaras municipais, tribunais de contas e SAPL | Implantação progressiva pendente |

A contagem por UF corresponde à representação dos deputados indexados. A localização do beneficiário de um pagamento exige informação específica de outra fonte.

## Auditoria da Fase 01
O banco preservado contém recortes oficiais, com coleta de despesas interrompida na página 2 e tarefas nominais pendentes. Consulte PROJECT_STATE.md para as contagens observadas. A contagem de proposições representa registros por autor no índice e o summary deduplica proposalId. A verificação desta fase usou documentos persistidos e consultas locais. Homologações de fontes adicionais permanecem pendentes.

## Enriquecimento legislativo
O caso 2520670-66 foi enriquecido a partir de dez respostas oficiais complementares. A API Explorer apresenta os registros interpretados, as respostas publicáveis e os metadados. Votos, orientações, autoria, tramitação, sessão, pauta, órgão e fichas de proposições foram relacionados. O diagnóstico e os limites estão em VOTE_AUDIT.md e ENRICHMENT_SOURCES.md. O enriquecimento de outras votações é progressivo e acionado pela fila. O índice ainda contém votações sem contexto complementar.

Homologação anual CEAP: https://www.camara.leg.br/cotas/Ano-2025.csv.zip, listado pela documentação oficial de downloads. Campo ideCadastro corresponde ao ID da API; nuDeputadoId é outro identificador interno. Comparação local apresenta divergência de sinal e quantidade, sem resolução documental; importação publicável não habilitada. Referência: https://dadosabertos.camara.leg.br/howtouse/2023-12-26-dados-ceap.html. Não presumir que arquivo e API sejam intercambiáveis.

OpenAPI oficial conferido em https://dadosabertos.camara.leg.br/api/v2/api-docs, versão informada 0.4.362 de 23/11/2026. Deputados, despesas, proposições e listagem de votações possuem pagina/itens. Votos de uma votação têm somente id/Accept; nenhum parâmetro de paginação foi inventado. Se essa resposta passar a anunciar próxima página, o contrato atual interrompe para revisão, sem afirmar ciclo completo. Lista nominal vazia pode representar votação simbólica; não significa parlamentar ausente. O ciclo do Scout distingue linhas observadas, validadas, publicadas e parcialidade; o total institucional independente permanece desconhecido quando a fonte não o informa.
