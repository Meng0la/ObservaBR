# Continuidade — ObservaBR
Checkpoint em 26/11/2026. Fase atual é a Fase 02, identidade visual e frontend. A Fase 02 está implementada e validada. Nenhuma próxima fase está autorizada automaticamente.

## Última entrega
Direção híbrida selecionada após dois protótipos locais. Panorama editorial e exploração documental usam Manrope, Newsreader e IBM Plex Mono, temas OKLCH, marca tipográfica, tabelas, perfil contextual e painel de evidências. Mapa IBGE mantém o worker Vite e possui tooltip e navegação por UF. Fontes e Cobertura concentra fila, falhas e períodos documentais.

O diretório ganhou filtros reais de partido e ordenação, com suporte parametrizado na API. A rota #sistema demonstra os componentes. Bibliotecas de mapa, gráfico e grafo usam imports dinâmicos. Fotografias possuem fallback quando a origem fica indisponível.

## Dados e limites preservados
A API local confirmou 513 representantes, 100 despesas, 46 proposições distintas e 46 vínculos de autoria, 1.585 votações e 404 registros nominais. Os valores continuam parciais.
A coleta de despesas de 204379/2025 foi interrompida na página 2 por chaves ambíguas. O coletor contém uma chave revisada e scripts/reidentify-expenses.ts existe, mas reidentificação, conciliação e retomada permanecem pendentes. Nenhuma coleta ou migration foi executada na Fase 02.
As votações são um recorte mensal. A listagem de deputados reflete o momento da coleta. Cobertura estadual, municipal, judicial e de outras instituições exige homologação própria. Não interpretar dados parciais como abrangência nacional completa.

## Verificação
npm test com banco isolado observabr_test — 8 aprovados, 1 contrato externo ignorado.
TypeScript, build, smoke HTTP, navegação de fixture a 375 px e navegação sobre os registros reais — aprovados.
Sentinela sintética de segredo ausente nos 16 arquivos do build.
A matriz em tests/phase02.test.mjs gera 30 screenshots de três páginas em 390, 768, 1024, 1440 e 1920 px nos dois temas. As capturas avaliadas não apresentam overflow de página nem falhas de contraste amostrado. A verificação completa de interações passou após corrigir os nomes acessíveis dos filtros. Consulte PHASE02_VALIDATION.md e VISUAL_AUDIT.md para resultado final.

Tentativas iniciais detectaram bloqueio de rede do sandbox em fotografias e timeouts de navegação. A execução com rede autorizada permite conferir as fotos institucionais. O teste passou a espaçar chamadas para respeitar os limites da aplicação. O contraste automatizado cobre texto HTML em superfícies sólidas, com canvas e imagens conferidos visualmente. Permanece necessário ampliar auditorias com leitores de tela e dispositivos físicos antes de publicação.

## Arquivos relevantes
- apps/web/src/tokens.css, fonts.css e style.css — sistema visual.
- apps/web/src/main.js, ui.js, visuals.js e system.js — composição, filtros, fontes, mapa e demonstração.
- apps/web/index.html e public/mark.svg — shell e marca.
- apps/web/public/licenses e docs/licenses — avisos OFL das fontes.
- apps/api/app.ts — filtros reais, partidos e períodos observados.
- tests/api.test.ts, pipeline.test.ts, phase02.test.mjs e apps/web/tests — contratos e validação.
- DESIGN.md, DESIGN_SYSTEM.md, DESIGN_REFERENCES.md, PHASE02_API.md e PHASE02_VALIDATION.md — decisões e resultados.

## Ambiente e comandos
O projeto agora possui Git, com commit inicial 906434c. Nesta retomada nenhuma ação de commit, push ou deploy foi realizada. A ausência de versionamento registrada na Fase 01 descreve o estado anterior.
Node portátil 24.22.3 em .tools/node-v24.22.3-win-x64. PostgreSQL 17.12 preservado em .tools/pgdata, porta 54672. Credenciais permanecem em .tools/*.pass ignorados pelo Git. Migrations 001_core e 002_observacoes.
Para executar, inclua o diretório Node no PATH, configure DATABASE_URL de leitura e use npm start. A instância de validação está em http://127.0.0.1:3001. O Scout usa credencial separada e continua sujeito ao escopo de coleta autorizado.
npm ci instala dependências fixas. npm run build compila. TEST_DATABASE_URL deve apontar exclusivamente a observabr_test ao executar npm test. Para navegador, configure CHROME_BIN, OBSERVABR_TEST_URL e execute node --test tests/phase02.test.mjs. O teste de live usa os dados locais e não equivale a contrato remoto.
Docker Engine e execução remota do CI não foram validados nesta fase.

## Artefatos e desempenho
Recuperação seletiva anterior às mudanças em .tools/phase02-recovery, sem credenciais. Capturas antes, depois e protótipos em .tools/phase02. Esses arquivos locais são ignorados pelo Git e devem ser preservados para comparação.
A soma gzip do pacote diminuiu aproximadamente 7,9%. O aviso de chunks acima de 500 kB continua, principalmente MapLibre e worker. Tempos de três amostras locais variaram entre as rotas, conforme PHASE02_VALIDATION.md. Não representam garantia de desempenho de produção.

## Próximo checkpoint
Matriz final aprovada em 26/11/2026, com 30 capturas e verificações de mapa, filtros, exportação, teclado e painel documental. Aguardar a definição da próxima tarefa. Pendências de dados incluem conciliação, exclusões na origem, fila e sua prioridade. Operação pública ainda exige retenção, restauração de backup, limites globais e governança de correções.