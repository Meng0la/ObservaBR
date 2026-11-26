# Roteiro de implementação
Etapa atual autorizada: engenharia de dados e fechamento progressivo da Câmara. Conciliação em isolamento validada; lote geral, cobertura, backup e métricas em implementação. Produção aguarda aprovação operacional para conciliação e agendamento geral. Consulte DATA_ENGINEERING_VALIDATION.md.

## Frequência e Atividade — planejamento futuro
Reunir presenças e ausências oficialmente registradas, justificativas, licenças, missões institucionais, participação em comissões e descontos remuneratórios publicados. Ausência de registro não demonstra ausência de trabalho. Não atribuir horas trabalhadas sem documentação suficiente. Módulo não implementado nesta etapa.


1. Fundação. Validar contratos da Câmara, separar API pública do coletor e definir chaves de identidade, acesso e proveniência.
2. Primeiro corte vertical. Importar a lista de deputados, indexar despesas e proposições por autor e votações com registros nominais. Validar a busca, exportação e atualização idempotente.
3. Expansão federal. Homologar cada conjunto separadamente, começando pelo Senado. Associar resultados eleitorais, posse e exercício por eventos distintos.
4. Expansão territorial. Pilotar uma casa SAPL com identificadores próprios e documentar datas e abrangência antes de agregar indicadores.
5. Inteligência. Introduzir busca documental e ferramentas de cálculo restritas. Exigir referências por afirmação e testar abstinência com dados insuficientes.
6. Publicação. Verificar recuperação do banco, acessibilidade, limites de carga, dependências e governança de correções antes do lançamento público.

O README discrimina a entrega testada. A habilitação de um conector depende de amostra oficial, contrato de dados, política de acesso e teste de atualização.

## Sequência aprovada após auditoria
Fase 01 estabelece auditoria e governança. Fase 02 trata identidade visual e design system e foi autorizada nesta tarefa.
O escopo futuro inclui cadastro nacional, Scout, despesas, votações, proposições, emendas, patrimônio e financiamento eleitoral, contratos, licitações, obras, programas, histórico judicial e administrativo, investigações oficiais, condenações e absolvições, grafos, RAG, pesquisa global, transparência financeira do projeto e apoio/financiamento.
Cada módulo depende de fonte homologada, identidade institucional, evidência individual, testes e cobertura explícita. Informações judiciais exigem vínculo comprovado da identidade, contexto processual e atualização de decisões.

## Fase 02 — entrega de frontend
Direção híbrida editorial e documental implementada. Identidade tipográfica, tokens OKLCH, temas, composição pública, diretório e perfil, evidências, cartografia e demonstração de componentes. Consulte VISUAL_AUDIT.md e PROJECT_STATE.md para verificação e limitações. A evolução dos dados e as próximas fases exigem tarefa própria.

## Etapa autorizada de enriquecimento
Implementados registro de recursos, snapshots públicos, cache e fila complementar, relações com evidência, votação contextualizada e API Explorer reutilizável. Caso inicial validado no PLP 128/2025, destaque 8. A expansão do mesmo mecanismo às demais votações é progressiva. Novas instituições, XML e módulos sem conector homologado exigem contrato e política de publicação próprios.

Checkpoint de engenharia de dados: piloto geral validado somente localmente; workflow manual preparado. Publicação do schema/conciliação e cron geral continuam sujeitos à autorização operacional. Importação anual em homologação devido à divergência API/arquivo. Histórico de migrations reconciliado; POC local e restauração comprovadas. O mantenedor optou por manter apenas o procedimento de backup preparado; destino e cron externo adiados. PR #1 em rascunho. Ver DATA_ENGINEERING_VALIDATION.md.
