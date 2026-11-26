# Design system implementado na Fase 02
A demonstração local está na rota #sistema. Os tokens em apps/web/src/tokens.css são a fonte central de cor, tipografia, espaçamento, motion e superfícies. style.css aplica esses contratos. fonts.css carrega três arquivos WOFF2 locais com font-display swap.

## Tokens
Primitivos slate, blue, clay e red são declarados em OKLCH. Os temas mapeiam bg, panel, well, ink, muted, line, accent, active, accent-bg, brand, on-action, focus, selection, info, warning e error. Cartografia usa map-empty, map-low, map-mid, map-high e map-selected. A escala representa a contagem de deputados indexados, sem julgamento político.
A tipografia usa sans Manrope, serif Newsreader e mono IBM Plex Mono. Caption e label preservam leitura dos metadados. Números usam font-variant-numeric tabular-nums. Espaçamento usa s1 a s9, gutter e measure. Elevação é mínima. Transições fast e enter usam durações curtas.

## Componentes e conteúdo
Masthead com olho SVG e assinatura tipográfica, navegação horizontal, pesquisa com autocomplete, filtros contextuais e tabelas compartilham a mesma base. O elemento reutilizável observa-eye usa --ink e --brand, contorno fixo e acompanhamento discreto da íris e pupila; touch e movimento reduzido mantêm a marca estática. Seu contrato está em DESIGN.md. Diretório apresenta fotografias institucionais, partido e UF em linhas compactas. Partido e ordenação são filtros implementados no servidor, com paginação de 25 registros e exportação por página.
O perfil preserva visão geral, despesas, proposições, votos e vínculo institucional. A aba Fontes abre a evidência do cadastro. O painel documental é um dialog nativo com título acessível, foco contido, Escape e retorno ao acionador. Coleta, verificação, publicação indisponível, período e hash aparecem conforme o registro. Conteúdo externo permanece texto.
Estados vazios descrevem ausência local e cobertura. A página Fontes apresenta dados operacionais e datas observadas, que podem conter lacunas. O financeiro apresenta aviso de conciliação pendente.

## Cartografia e gráficos
MapLibre mantém setWorkerUrl com worker emitido pelo Vite. Malha IBGE local, tooltip com contagem e UF, controles de zoom e seleção equivalente por lista. Mapa e gráficos adotam os tokens do tema. ECharts carrega no histórico de despesas e Cytoscape no vínculo institucional.
As bibliotecas usam imports dinâmicos. Nenhuma substituição de dependência foi feita para ocultar avisos de tamanho.

## Interação e acessibilidade
CSS transitions indicam hover e foco. Web Animations API anima navegação e entrada sequencial em grupos, com 160–180 ms e pequenos atrasos. Documentos possuem feedback discreto. prefers-reduced-motion desativa os movimentos.
Foco visível, skip link, navegação contextual, labels e tabelas com cabeçalhos semânticos integram os componentes. Containers de tabela podem rolar horizontalmente e receber foco. A página completa deve caber no viewport.
A validação e seus limites constam em VISUAL_AUDIT.md.
## Votação documental e API Explorer
A votação usa navegação contextual, placar proclamado com denominador explícito, categorias nominais separadas e tabelas de autoria, orientações e tramitação. O Explorer tem abas acessíveis e árvore JSON com limites, controles de cópia/exportação e apresentação explícita de supressões. Os novos componentes usam os tokens existentes e carregamento sob demanda. Os rótulos descrevem a condição documental da fonte, sem classificação de posicionamentos políticos.
