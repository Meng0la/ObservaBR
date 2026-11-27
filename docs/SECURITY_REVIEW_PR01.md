# Remediação de segurança — PR nº 1

## Resultado

Etapa objetiva concluída em 27/11/2026 sobre `data-engineering-controlled-ingestion`. SR-01, SR-02, SR-03, SR-04, SR-05 e SR-08 receberam correção delimitada e testes de regressão. Não houve acesso ofensivo, deploy, merge ou migration em produção.

| Achado | Situação | Controle implementado |
|---|---|---|
| SR-01 | Corrigido | Reader limitado às tabelas e colunas consumidas pela API; objetos operacionais internos negados |
| SR-02 | Corrigido | Bytes e trilhas de coleta append-only para o worker; identidade/encerramento de ciclos protegidos; contadores derivados de recibos |
| SR-03 | Corrigido | Limite específico, cache curto e limitado, concorrência máxima e timeout transacional na cobertura |
| SR-04 | Corrigido | Conexões PostgreSQL remotas falham sem `verify-full` e CA confiável; conexões locais preservadas |
| SR-05 | Corrigido | Actions fixadas por commit e imagens fixadas por digest obtido nas origens oficiais |
| SR-08 | Corrigido | Processo de dump recebe allowlist de ambiente e não herda chave de criptografia ou URL da aplicação |

O relatório registra o resultado e os controles sem reproduzir procedimentos de exploração. A matriz completa da auditoria permanece no histórico local de trabalho até a conclusão das correções.

## Riscos residuais aceitos para a próxima etapa

- **SR-06 — baixo:** o download anual já possui origem HTTPS fixa, redirects manuais, orçamento e validação de endereço. A unificação do transporte DNS com o coletor JSON fica para a próxima etapa de segurança. Não bloqueia a publicação controlada atual.
- **SR-07 — baixo:** a implantação Render declara `/api/health` no orquestrador. Um `HEALTHCHECK` no Dockerfile continua como melhoria de portabilidade e não bloqueia essa publicação.

Permanecem os avisos preexistentes de depreciação Fastify/pg e chunks Vite grandes; não foram introduzidos nem ampliados por esta remediação.

## Validação

- 22 testes direcionados: aprovados.
- Suíte completa local: 43 aprovados, dois contratos externos opcionais ignorados, zero falhas.
- Typecheck: aprovado.
- Build: aprovado.
- Gitleaks 8.30.1: zero achados nos diretórios versionáveis.
- `npm audit`: zero vulnerabilidades conhecidas.
- CI Linux: executa testes, Gitleaks, CodeQL, Semgrep OWASP e Trivy da imagem; o resultado do commit de remediação deve estar aprovado antes de qualquer publicação.

Os testes cobrem negação do reader, imutabilidade para o writer, derivação dos contadores, cache, rate limit, timeout, limite de concorrência, TLS remoto, tag GCM explícita e isolamento do ambiente do backup. Relatórios brutos locais permanecem em `.tools/security-review` e não são versionados.

## Ordem exata de publicação

As migrations já presentes na produção permanecem inalteradas:

1. `20261125000100_core.sql`
2. `20261125000200_observacoes.sql`
3. `20261126114431_enrichment.sql`
4. `20261126115334_cloud_service_roles.sql`
5. `20261126115831_cloud_security.sql`

Para a entrega pendente, a ordem obrigatória é:

1. Confirmar backup privado e ensaio de restauração autorizado.
2. Aplicar `20261126160503_data_engineering.sql`.
3. Aplicar `20261126171500_backfill_coverage.sql`.
4. Aplicar `20261127110000_persistent_cycle_mode.sql`.
5. Publicar o novo runtime e validar `/api/health`, `/api/summary`, `/api/coverage` e acesso por aliases usando exclusivamente o reader.
6. Aplicar `20261127123000_security_hardening.sql`.
7. Repetir smoke da API, testes negativos de privilégios e uma execução manual limitada do Scout com o writer.
8. Somente com autorização operacional separada considerar a coleta geral; o schedule continua desabilitado.

O runtime atual continua compatível durante as etapas 2–4. A revogação final ocorre somente depois que o runtime novo deixa de consultar a coluna operacional antiga, evitando indisponibilidade durante a transição. Em banco vazio, aplicar todas as migrations em ordem lexical antes de iniciar o runtime.

## Rollback

1. Interromper Scout geral e complementar; não iniciar novos ciclos.
2. Se uma migration falhar, preservar o rollback transacional automático e não avançar.
3. Se o runtime falhar antes do hardening, retornar ao runtime anterior; as três migrations funcionais são aditivas e permanecem aplicadas.
4. Se o runtime falhar depois do hardening, manter evidências append-only e o schema; retornar ao runtime anterior somente após conceder temporariamente ao reader a coluna operacional exigida por ele. Não restaurar leitura das tabelas internas nem `UPDATE`/`DELETE` sobre evidências.
5. Se o trigger de ciclos causar incompatibilidade comprovada, parar os workers e substituir apenas a função pelo contrato anterior de identidade, preservando as revogações append-only. Registrar o incidente e exigir nova revisão antes de retomar.
6. Revalidar hashes, recibos, ciclos ativos, RLS e endpoints antes de qualquer retomada.

Não apagar migrations aplicadas, recibos, aliases, revisões, quarentena ou documentos para executar rollback.

## Parecer de prontidão

O código fica **tecnicamente pronto para publicação controlada** quando o CI Linux do commit de remediação estiver integralmente aprovado. Isso não autoriza merge, deploy, migrations ou ativação da coleta. A publicação ainda depende de revisão do mantenedor, backup/restauração autorizado e autorização explícita para cada etapa operacional.
