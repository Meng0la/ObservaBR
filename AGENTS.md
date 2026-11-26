# ObservaBR — instruções permanentes
## Engenharia de dados
Conciliação de despesas e agendamento geral exigem piloto isolado, dry-run revisável e autorização operacional explícita antes da produção. Preservar bytes, revisões e aliases; não excluir registros para resolver colisões. Manter o agendamento complementar separado. A etapa não autoriza coleta massiva, serviços faturáveis, módulo judicial ou IA. Atualizar DATA_ENGINEERING_VALIDATION.md e os documentos de continuidade após cada marco.

## Missão
Manter uma plataforma aberta, independente e apartidária de inteligência pública baseada em fontes verificáveis. Aplicar presunção de inocência, privacidade e critérios uniformes.

## Retomada
Leia primeiro docs/PROJECT_STATE.md, AGENTS.md e os documentos da tarefa. Verifique estado do Git, processos e migrations. Preserve trabalho existente. Atualize PROJECT_STATE.md após cada tarefa significativa com resultado real, testes e próximo checkpoint. Não dependa do histórico do chat.

## Arquitetura e código
Preserve módulos e contratos existentes. API de leitura e Scout de escrita usam credenciais distintas. PostgreSQL é o armazenamento atual. Tecnologias futuras exigem necessidade medida. Use TypeScript no backend, parâmetros SQL, validação de entrada e NUMERIC para dinheiro. Mantenha diffs delimitados e código legível.

## Segurança e privacidade
Segredos ficam exclusivamente no backend e fora do versionamento. Revise privilégios e RLS em mudanças SQL. Coletores aceitam apenas recursos institucionais homologados, validam destinos, redirecionamentos, tamanho e timeout. Respeite limites e bloqueios. Não publique CPF completo, endereço residencial, dados sensíveis desnecessários ou vazamentos. Documentos brutos e backups têm acesso restrito.

## Evidências
Cada registro publicado exige origem exata, identificador, data de coleta, campo, hash e versão do coletor. Preserve valores ausentes e significado do voto. Coincidência nominal nunca comprova identidade, investigação ou acusação. Separe alegação, investigação, decisão, condenação e absolvição.

## Visual
Antes de editar frontend, leia DESIGN.md e docs/DESIGN_SYSTEM.md. A identidade editorial e investigativa da Fase 02 está definida em DESIGN.md. Não introduza Inter ou Roboto como fonte principal, gradientes roxos decorativos, glassmorphism, emojis, arredondamento indiscriminado, dashboards genéricos, vazios sem função ou terminal hacker. Alterações visuais significativas exigem navegador, screenshots e responsividade.

## Testes e documentação
Funcionalidade concluída exige implementação e validação pelos pontos reais de entrada. Execute testes adequados, typecheck e build. Fixtures pertencem exclusivamente aos testes. Registre falhas, testes ignorados e limitações. Documente mudanças de contrato, schema, cobertura e decisões. Planejamento deve ser identificado explicitamente. Não avance de fase ou execute deploy sem autorização.
## Contrato visual após a Fase 02
Use Manrope para interface, Newsreader para títulos editoriais e IBM Plex Mono para dados. Centralize cores em apps/web/src/tokens.css e preserve temas completos. A rota #sistema demonstra componentes. Manter o worker MapLibre emitido pelo Vite e configurado com setWorkerUrl. Testes devem observar erros de console além do canvas. Frontend usa imports dinâmicos para mapa, gráficos e grafo. Preservar a distinção entre cobertura parcial, ausência de registro, processamento pendente e falha de fonte. Mudanças no diretório devem manter filtros e exportação reais no servidor.

## Enriquecimento e API Explorer
Detalhes complementares são coletados pelo Scout e armazenados antes da apresentação. A API pública consulta o índice e aceita somente tipo/ID homologados. Preserve o registro de rotas, cache persistente, lock do consumidor, deduplicação e política de supressão. Nunca apresente uma projeção com supressões como resposta integral. O SHA-256 refere-se aos bytes coletados. Preserve a distinção entre placar oficial, registros nominais, orientação de bancada, proposição principal, possíveis objetos e objeto efetivamente votado. Cada interpretação deve conservar referências por campo. Uma nova coleta mensal deve preservar o contexto já enriquecido até sua atualização pelo detalhe homologado.

Checkpoint operacional: fila geral preparada somente para execução manual; não habilitar schedule sem aprovação. Divergência comprovada entre API e arquivo anual CEAP bloqueia a substituição automática de valores. Não inverter sinais por heurística. Histórico remoto reconciliado; migration nova continua local. Backup externo exige destino privado verificado; ensaio local não equivale a rotina externa ativa.
