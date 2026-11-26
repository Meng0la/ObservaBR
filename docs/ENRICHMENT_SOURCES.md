# Câmara — contratos de enriquecimento
A auditoria do caso PLP 128/2025 está em VOTE_AUDIT.md. Os contratos foram verificados em chamadas reais e nos testes de enriquecimento.

| Recurso | Finalidade |
|---|---|
| votacoes/{id} | Objeto, descrição de abertura, afetadas, possíveis objetos, data e resultado |
| votacoes/{id}/votos | Registros individuais, incluindo partido, UF e fotografia na resposta nominal |
| votacoes/{id}/orientacoes | Orientações de bancada, apresentadas separadamente dos votos |
| proposicoes/{id} | Tipo, número, ano, ementa e documento principal |
| proposicoes/{id}/autores | Autores e tipo institucional |
| proposicoes/{id}/tramitacoes | Andamentos publicados |
| eventos/{id} e eventos/{id}/pauta | Sessão e matérias da pauta |
| orgaos/{id} | Identificação do órgão por extenso |

As URLs pertencem à API de Dados Abertos da Câmara. ID de votação possui o formato institucional numérico com sufixo. Os demais IDs são numéricos. Nome de recurso e destino não vêm de URL fornecida pelo visitante.

A API pode relacionar muitos objetos possíveis. O primeiro elemento não define o objeto votado. O caso documentado traz 54 possíveis objetos e uma proposição afetada. A abertura identifica DTQ 8 e artigo 8º do substitutivo do PLP 128/2025. Foram aprofundadas as fichas do projeto e do destaque, com limite de quatro por votação. Relações restantes preservam o tipo “possível” e a ficha indica quando falta complemento.

Os endpoints de listas complementares consultados retornaram coleções completas sem próximo link. Se uma resposta futura indicar paginação adicional, o conector interrompe aquele recurso e registra a necessidade de revisar seu contrato. As listagens principais já possuem paginação e checkpoints. A interface nominal pagina o índice em 25 linhas e exporta a página filtrada.

A data da sessão e o registro temporal são campos distintos. O horário de registro desse caso está no dia seguinte à data da sessão. A apresentação conserva ambos os campos, sem inferir um novo dia legislativo.

Fontes de metodologia e validação estão nos links do VOTE_AUDIT.md. A consulta direta ao documento codteor=3069283 recebeu HTTP 429 na ferramenta de navegação. A identificação do caso foi confirmada pelo detalhe, pauta, tramitações e resultado da sessão. Nenhum bloqueio foi contornado.


No índice atual, 1.584 votações tiveram evento, órgão e horário recuperados diretamente do documento arquivado. A coleta da votação com contexto preserva a procedência do detalhe. Na consulta de proposições por identificador institucional, a API resolve também os registros anteriores de autoria com o mesmo proposalId, mantendo o documento que comprova aquele registro.
