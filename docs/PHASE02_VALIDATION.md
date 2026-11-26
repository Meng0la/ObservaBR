# Validação da Fase 02
Verificação retomada em 26/11/2026. O frontend final foi compilado com Vite e servido pela API local na porta 3001. Os dados consultados são o acervo PostgreSQL preservado.

## Testes executados
- npm test com TEST_DATABASE_URL em observabr_test — 8 aprovados, 1 contrato externo ignorado, zero falhas.
- npm run typecheck — aprovado.
- npm run build — aprovado, mantendo aviso de chunks acima de 500 kB.
- tests/client-secrets.mjs com sentinela sintética no ambiente de build — aprovada, ausente nos 16 arquivos publicados.
- tests/http-smoke.mjs contra 3001 — aprovado.
- apps/web/tests/browser.test.mjs — aprovado, incluindo viewport de 375 px.
- apps/web/tests/live.test.mjs — aprovado, incluindo perfil, despesa, histórico e votação nominal.
- tests/phase02.test.mjs — valida matriz visual, contraste amostrado, mapa, filtros, exportação e teclado. Consulte VISUAL_AUDIT.md para o resultado final e limites.

As tentativas iniciais da matriz encontraram bloqueio de rede para fotografias externas e timeout na espera do mapa. A investigação preservou capturas diagnósticas. Nenhum desses resultados foi registrado como aprovação.

## Métricas
Arquivo reproduzível de medição local em .tools/phase02/measure.mjs. Resultados em .tools/phase02/after/performance.json. Baseline capturada antes das alterações em 25/11/2026. Medição final em 26/11/2026. Cada rota usa três contextos novos de Chrome, viewport 1440 x 960, sem throttling e com redução de movimento. Valores abaixo são medianas em milissegundos.

| Rota | DCL antes | DCL depois | FCP antes | FCP depois |
|---|---:|---:|---:|---:|
| Panorama | 204,9 | 152,8 | 180 | 172 |
| Diretório | 154,6 | 158,4 | 132 | 148 |
| Perfil | 103,5 | 150,0 | 208 | 144 |

As duas medições ocorreram em momentos distintos, com variação de cache do sistema, banco e rede. Esses números descrevem a amostra local e não estabelecem desempenho em produção.
O pacote estático completo passou de 3.016.982 para 2.959.320 bytes. A soma gzip por arquivo passou de 1.070.899 para 986.717 bytes, redução de aproximadamente 7,9%. Inclui os textos das licenças das fontes. São tamanhos de distribuição, não transferência obrigatória por navegação.

MapLibre e seu worker são os maiores ativos. ECharts, Cytoscape, MapLibre e a demonstração de componentes usam imports dinâmicos. O diretório e o perfil geral não precisam carregar essas bibliotecas. Três WOFF2 substituíram o conjunto anterior de fontes. O aviso de tamanho permanece visível e não foi ocultado por configuração.

O marcador ready registra o instante em que o conteúdo principal encerrou o estado aria-busy. Ele não mede conclusão de carregamento do mapa, dos gráficos ou das fotos. A validação funcional verifica esses componentes separadamente. As listas de recursos da amostra representam apenas os recursos concluídos até esse marcador.

## Resultado final
A matriz completa passou em 26/11/2026, com 1 teste aprovado, zero falhas, duração de 87,98 s. Os 30 screenshots e o relatório matrix.json foram atualizados. Também passaram seleção e conferência de estado no mapa, filtros e exportação, foco do dialog, Escape, skip link, atalho de pesquisa e feedback da página #sistema.
