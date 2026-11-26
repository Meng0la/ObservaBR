# Auditoria da votação 2520670-66

Em 26/11/2026, o índice local associava a votação de 16/12/2025 ao resultado de manutenção de um texto. O objeto está identificado na abertura da votação publicada pela Câmara. Trata-se do destaque nº 8, apresentado pelo NOVO, para votar separadamente o artigo 8º do substitutivo ao PLP 128/2025. O resultado da sessão extraordinária também registra a abertura e o resultado desse destaque. [Detalhe da votação](https://dadosabertos.camara.leg.br/api/v2/votacoes/2520670-66) · [Resultado da sessão, item 3](https://www.camara.leg.br/internet/ordemdodia/integras/3069282.htm)

## Estado anterior ao enriquecimento

O levantamento tomou o commit `f9512fa` como referência. A conexão usou o login da API e `default_transaction_read_only=on`. O papel de leitura não tem permissão para selecionar os bytes de `source_documents`. Para verificar as evidências sem ampliar o acesso, repetimos o GET das duas URLs registradas em `records`, com `Accept: application/json`, e comparamos o SHA-256 dos bytes recebidos ao hash persistido.

| Material consultado | Identificação e resultado |
| --- | --- |
| Listagem mensal, página 1 | 100 itens solicitados, votação no ponteiro JSON `/dados/92`. SHA-256 idêntico ao armazenado, `eb513ad39eab918c436256667b4891a75e94ed3625dc499a8b5bc8aa7cdabbbb`. [Publicação](https://dadosabertos.camara.leg.br/api/v2/votacoes?dataInicio=2025-12-01&dataFim=2025-12-31&itens=100&pagina=1) |
| Votos nominais | 404 linhas. SHA-256 idêntico ao armazenado, `0e3b9c8c7374135953c3d0934be225e2e91926e57068931a702abdde51dee465`. [Publicação](https://dadosabertos.camara.leg.br/api/v2/votacoes/2520670-66/votos) |
| Detalhe complementar | SHA-256 da resposta obtida na auditoria, `6f433b35a4987679d6b9327b598e84b7f1e5e04af37991073fc17eae24fd6547`. [Publicação](https://dadosabertos.camara.leg.br/api/v2/votacoes/2520670-66) |

| Origem do campo | Observação no índice anterior |
| --- | --- |
| Listagem, `descricao`, `siglaOrgao`, `data`, `uri` | Preservados em título, descrição, órgão abreviado, data e URL da fonte. O componente de detalhe exibia diretamente o título e a descrição. |
| Listagem, `proposicaoObjeto`, `uriProposicaoObjeto`, `aprovacao` | Os três campos já vieram nulos. Essa resposta mensal, isoladamente, não permite identificar o artigo ou concluir aprovação do projeto principal. |
| Listagem, `uriEvento`, `uriOrgao`, `dataHoraRegistro` | A resposta inclui o evento 80835, o órgão 180 e o registro em 17/12/2025 às 01h31min24s. O normalizador descartava esses campos. A data da sessão permanece 16/12/2025. |
| Detalhe, `descUltimaAberturaVotacao` | Indica destaque, artigo e projeto. A abertura foi registrada em 17/12/2025 às 00h52min40s. Esses dados exigem consultar o detalhe. |
| Detalhe, `proposicoesAfetadas` e `objetosPossiveis` | Uma proposição afetada, PLP 128/2025, ID 2520670. Há 54 possíveis objetos. O ID 2597595 corresponde ao candidato DTQ 8. O primeiro elemento é 2597607. A determinação do objeto decorre do texto da abertura corroborado pelo resultado da sessão. |
| Detalhe, `ultimaApresentacaoProposicao` | Registra parecer às emendas, com URI da proposição 2597601. É outra tramitação da sessão. |
| Votos, `deputado_` | Os 404 registros trazem ID, nome, partido, UF, foto e outros campos. O normalizador guardava o ID em `owner`, além de nome, voto, horário e vínculo com a votação. Partido, UF e foto disponíveis no registro nominal ficavam fora da projeção. O campo de e-mail fica fora da interface pública. |

O índice continha 1.585 votações de dezembro em 16 páginas e 16 hashes. Em 841 votações o atributo normalizado `object` estava ausente ou nulo. Entre os títulos, 18 continham “Mantido o texto” e 46 incluíam um placar com “Sim:”. Esses contadores delimitam o diagnóstico local. Para estimar a cobertura do enriquecimento, é necessário verificar os detalhes de cada votação. [Metodologia da Câmara](https://dadosabertos.camara.leg.br/howtouse/2020-02-07-dados-votacoes.html)

A fila continha um trabalho concluído de listagem e outro pendente. Para votos individuais, havia um trabalho concluído e 1.584 pendentes. Todas as 404 linhas nominais indexadas pertenciam à votação examinada. Nenhum dos 46 registros de autoria do módulo de proposições apontava para o ID 2520670. O fluxo anterior consultava a listagem e os votos e oferecia o endereço externo do detalhe. Não persistia o detalhe, orientações ou as relações complementares.

## Placar e registros nominais

O resultado oficial informa 286 votos Sim e 116 votos Não, com total de 402. Isso dá 71,14% e 28,86% sobre os 402 votos do placar. A publicação nominal tem 404 identificadores distintos, distribuídos em 286 Sim, 116 Não, um registro de Obstrução e um de Artigo 17. O texto do resultado não discrimina abstenção ou obstrução. A interface deve preservar a origem de cada contagem e o significado de cada categoria. [Resultado oficial](https://www.camara.leg.br/internet/ordemdodia/integras/3069282.htm) · [Registros nominais](https://dadosabertos.camara.leg.br/api/v2/votacoes/2520670-66/votos)
