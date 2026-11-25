# Roteiro de implementação

1. Fundação. Validar contratos da Câmara, separar API pública do coletor e definir chaves de identidade, acesso e proveniência.
2. Primeiro corte vertical. Importar a lista de deputados, indexar despesas e proposições por autor e votações com registros nominais. Validar a busca, exportação e atualização idempotente.
3. Expansão federal. Homologar cada conjunto separadamente, começando pelo Senado. Associar resultados eleitorais, posse e exercício por eventos distintos.
4. Expansão territorial. Pilotar uma casa SAPL com identificadores próprios e documentar datas e abrangência antes de agregar indicadores.
5. Inteligência. Introduzir busca documental e ferramentas de cálculo restritas. Exigir referências por afirmação e testar abstinência com dados insuficientes.
6. Publicação. Verificar recuperação do banco, acessibilidade, limites de carga, dependências e governança de correções antes do lançamento público.

O README discrimina a entrega testada. A habilitação de um conector depende de amostra oficial, contrato de dados, política de acesso e teste de atualização.

## Sequência aprovada após auditoria
Fase 01 estabelece auditoria e governança. Fase 02 trata identidade visual e design system e aguarda autorização.
O escopo futuro inclui cadastro nacional, Scout, despesas, votações, proposições, emendas, patrimônio e financiamento eleitoral, contratos, licitações, obras, programas, histórico judicial e administrativo, investigações oficiais, condenações e absolvições, grafos, RAG, pesquisa global, transparência financeira do projeto e apoio/financiamento.
Cada módulo depende de fonte homologada, identidade institucional, evidência individual, testes e cobertura explícita. Informações judiciais exigem vínculo comprovado da identidade, contexto processual e atualização de decisões.

## Fase 02 — entrega de frontend
Direção híbrida editorial e documental implementada. Identidade tipográfica, tokens OKLCH, temas, composição pública, diretório e perfil, evidências, cartografia e demonstração de componentes. Consulte VISUAL_AUDIT.md e PROJECT_STATE.md para verificação e limitações. A evolução dos dados e as próximas fases exigem tarefa própria.
