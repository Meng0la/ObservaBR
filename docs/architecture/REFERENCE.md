# Referência de interface e cartografia

A estrutura pública do PortWatch VI reúne uma página HTML com navegação por seções, atualização visível no cabeçalho e módulos JavaScript. O CSS concentra cores e superfícies em propriedades customizadas e adapta o tema. O projeto separa a página pública, os arquivos de dados, o coletor agendado e os scripts de publicação. A consulta direta ao site não respondeu nesta sessão. A inspeção foi feita pelo repositório público. [HTML](https://github.com/4lwayz/portwatch-vi/blob/main/index.html) · [CSS](https://github.com/4lwayz/portwatch-vi/blob/main/assets/css/style.css) · [JavaScript](https://github.com/4lwayz/portwatch-vi/blob/main/assets/js/app.js) · [Automação](https://github.com/4lwayz/portwatch-vi/tree/main/.github/workflows)

O ObservaBR adota atualização explícita, navegação estável e leitura rápida de indicadores. Sua identidade visual usa cartografia, fundo escuro, tabelas e tipografia monoespaçada para valores. A lista pública da raiz consultada não apresentava arquivo de licença. A implementação gráfica e o código de interface foram escritos para este projeto. [Árvore do repositório](https://github.com/4lwayz/portwatch-vi)

## Malha do Brasil

O arquivo `apps/web/public/geo/uf.geojson` contém a resposta original da API de malhas do IBGE, obtida em 25/11/2026 às 14h03 UTC. A importação conferiu o tipo FeatureCollection e os 27 elementos. O hash SHA-256 é `07c671aa87aa1ab296c446de6294df9827112782537b996c0a160284907e7c0f`. A malha simplificada serve à navegação por UF. As contagens são calculadas pelo banco de dados do ObservaBR. [Publicação original do IBGE](https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=UF)
