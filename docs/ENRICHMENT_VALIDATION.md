# Validação do enriquecimento e API Explorer
Etapa executada em 26/11/2026, após o envio da Fase 02 no commit f9512fa.

## Auditoria e dados reais
A votação 2520670-66 foi identificada por sua descrição e pela data no acervo. A resposta mensal conservava o placar e tinha campos nulos de objeto. A resposta complementar fornece a abertura que identifica DTQ 8, artigo 8º do substitutivo e PLP 128/2025. A pauta, as fichas e a tramitação corroboram a interpretação. A auditoria completa está em VOTE_AUDIT.md.

Foram armazenadas dez respostas complementares, com reutilização do documento nominal existente. O projeto e o destaque tiveram fichas aprofundadas. As demais 53 proposições possíveis têm referências com origem e estado de complemento pendente. As classificações de afetada e possível permanecem distintas.

A API local confirmou 286 Sim, 116 Não e total oficial 402. O índice nominal contém 404 registros, incluindo Obstrução e Artigo 17. A interface apresenta separadamente placar e contagens nominais, sem inferir ausências. Os percentuais do gráfico usam o denominador oficial de 402.

O backfill público projetou 28 grupos de páginas vinculadas aos registros. O backfill de campos recuperou eventos, órgãos e registro temporal em 1.584 votações, sem novo download. O registro já contextualizado foi preservado. O índice resultante contém 101 proposições distintas, com 46 vínculos de autoria anteriores, 513 representantes, 100 despesas, 1.585 votações e 404 registros nominais.

## Testes executados
- npm test com TEST_DATABASE_URL em observabr_test. 13 aprovados, dois contratos externos ignorados no comando padrão, zero falhas.
- Contratos externos de Câmara e enriquecimento com OBSERVABR_LIVE=1. Nove testes aprovados, sem ignorados.
- npm run typecheck e npm run build aprovados.
- Sentinela sintética de segredo ausente nos 20 arquivos publicados.
- Smoke HTTP contra a instância de validação aprovado.
- Navegação com fixture, navegação real, votação real e matriz da Fase 02. Quatro testes de navegador aprovados.
- Matriz de regressão da Fase 02 com 30 capturas em cinco larguras e dois temas, sem overflow nem erros de execução.
- Teste específico da votação repetido com filtros reais de partido e voto, exportação, links de perfis e respostas oficiais, pesquisa e download de JSON e metadados.
- Contexto e tabela nominal verificados em 390, 768, 1024, 1440 e 1920 px, nos dois temas, com vinte capturas adicionais e zero overflow de página.

A integração demonstra cache sem nova chamada no reprocessamento, deduplicação de votos, preservação do título contextual numa nova importação mensal, supressão de dados e recusa do papel de leitura ao bruto. Os testes de transporte rejeitam URLs, query strings e recursos arbitrários antes da rede.

## Inspeção visual
Capturas em .tools/enrichment incluem a página contextual, a lista nominal e o Explorer. Foram inspecionados o contexto desktop escuro, o contexto móvel claro e os votos desktop escuros. A última apresentação longa passou a um bloco expansível em largura de leitura. Metadados ausentes têm texto de estado proporcional à interface. Os estilos reutilizam os tokens existentes e os módulos carregam sob demanda.

O teste de navegação do Explorer diferencia resposta integral e projeção suprimida. A exportação do detalhe oficial preservou a identidade e a proposição afetada, sem chaves pessoais restritas. O teste de frontend sobre os dados existentes foi atualizado para a nova rota contextual de votos.

## Limites
O enriquecimento completo foi aplicado inicialmente ao caso real validado. Outras votações seguem sob demanda e precisam do Scout ativo. As fichas possíveis restantes podem ter complemento solicitado por entidade. O JSON retornado pode ter supressões sinalizadas. O arquivo exportado é a serialização da projeção pública e seu espaçamento pode diferir dos bytes coletados, aos quais se refere o hash.

Listas complementares com paginação ainda não homologada geram aviso e coleta parcial, conforme ENRICHMENT_SOURCES.md. Não houve verificação de deploy ou execução remota do CI. Permanecem os avisos de depreciação do logger Fastify e do uso concorrente do client de teste pg, além do aviso de chunks maiores que 500 kB. As verificações de navegador e contraste amostrado não equivalem a auditoria integral de acessibilidade.
