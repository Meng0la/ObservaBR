# ObservaBR API Explorer

O explorador apresenta o registro interpretado pelo ObservaBR, o conteúdo público do documento coletado e a sua procedência. A navegação entre as três abas mantém o documento selecionado. Setas laterais, Home e End movem o foco entre as abas. Os resumos de objetos e arrays podem ser abertos pelo teclado.

## Contrato de integração

`createExplorer({kind, id, signal})` em `apps/web/src/explorer.js` devolve uma promessa de elemento HTML. O sinal interrompe a requisição quando o usuário sai da página. Uma falha recuperável apresenta uma ação de nova tentativa. O componente faz uma consulta de mesma origem a `GET /api/evidence/:kind/:id`. Alternar abas, trocar de documento, pesquisar campos e exportar utiliza a resposta em memória.

| Campo da resposta | Uso público |
|---|---|
| `normalized` | Título, identificador, tipo, data e campos estruturados do registro já normalizado. Despesas apresentam o valor líquido quando disponível. |
| `relations` | Links para registros internos resolvidos pelo backend. Cada vínculo fornece tipo, identificador e título. |
| `documents` | Cada documento tem identificador, recurso, conteúdo público e metadados da origem. O seletor aparece quando há mais de um documento. |
| `original` e `suppressedFields` do documento | O backend informa a integridade da projeção. A interface identifica um recorte público ou uma resposta com campos suprimidos. O rótulo “Resposta original da API” exige `original: true` e ausência de supressão indicada. |

Na aba de metadados, consulte instituição, URLs de publicação e API, método HTTP, identificadores, horários de coleta e verificação em Brasília, SHA-256 do conteúdo coletado, versão do coletor e situação da validação. Valores ausentes permanecem indisponíveis. A cópia e a exportação serializam o JSON público entregue pelo backend. O hash de origem permite conferir os bytes que o coletor recebeu, cuja formatação pode diferir da exportação.

## Leitura de documentos

O visualizador diferencia objeto, array, número, booleano, string e `null`. A pesquisa localiza nomes de campos sem distinção entre maiúsculas e minúsculas e mostra o caminho em JSON Pointer. Números nos caminhos indicam posições de arrays. O texto pesquisado e os valores da resposta entram no DOM como texto. Um trecho marcado com tags permanece legível como texto.

A árvore apresenta grupos de 30 filhos e permite avançar ou recuar dentro de cada coleção. A visualização limita os itens simultâneos a 500 e a profundidade a 24 níveis. Strings com mais de 2.000 caracteres recebem indicação de abreviação. A pesquisa examina até 15.000 itens e 48 níveis e devolve até 40 correspondências com indicação de limite. Cópia e exportação incluem o conteúdo integral da projeção pública selecionada.

A política de publicação é responsabilidade do backend. A resposta HTTP entregue ao navegador deve conter exclusivamente campos públicos e autorizados. O explorador só recebe identificadores de registros e consulta a rota interna fixa. Links documentais usam HTTPS e abrem a publicação original por ação explícita do usuário.

## Verificação local do componente

Em 26/11/2026, um teste isolado em Chrome com documentos sintéticos verificou seleção de abas por mouse e teclado, vínculo interno, supressão identificada, paginação de arrays, busca por campo, texto com marcação literal, cópia, conteúdo do arquivo JSON exportado, troca de documento, valor nulo e recuperação de erro HTTP. As verificações a 390 e 1440 px passaram sem overflow da página nem erros JavaScript. Os testes da API e do fluxo com registros da Câmara são documentados no checkpoint da entrega.
