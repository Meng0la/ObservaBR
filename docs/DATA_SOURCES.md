# Cobertura de dados
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
