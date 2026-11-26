# Armazenamento híbrido — planejamento
Backfill de 2026: arquivo anual oficial medido com 128.906 linhas em 4.802.417 bytes ZIP e 48.101.007 CSV. Staging privado local, sem mover produção. Piloto PostgreSQL isolado cresceu de 16.881.331 para 18.200.243 bytes, incluindo 215 novos registros, snapshots, índices e filas; não extrapolar como densidade universal. Rota de cobertura separa observações parciais de escopos completos. Estratégia e números em BACKFILL_STRATEGY.md/BACKFILL_METRICS.json.
Medição de 26/11/2026: banco remoto 21.124.787 bytes; records 2.433.024 de tabela + 3.244.032 de índices; revisões 2.039.808 + 81.920. Não extrapolar uma taxa diária a partir de um snapshot. A prova local com dados reais, Parquet/Zstandard e DuckDB está em preparação; produção permanece inteiramente no PostgreSQL.

Hoje todos os registros, documentos e revisões residem em PostgreSQL. Antes de arquivar, medir bytes por tipo, crescimento diário, p95 de consultas, WAL, tempo de backup e custo de restauração.
Hot mantém registros consultados e índices no PostgreSQL. Warm preserva PostgreSQL com índices e eventual particionamento baseado em volume e planos EXPLAIN. Cold prevê Parquet comprimido com Zstandard em R2/S3 e consultas DuckDB.
Cada objeto futuro deverá ter manifesto com origem, SHA-256, coletor, período, esquema e contagem. Arquivamento exige conferência antes de retirar dados do hot, procedimento reversível e teste de restauração. Definir retenção por base legal e finalidade, com acesso restrito ao bruto.
A fila persistente e os checkpoints atuais são por página. Coletas repetidas fazem upsert, mas exclusões na origem e identidade de lançamentos corrigidos exigem conciliação. Planejar ETag/Last-Modified, cache e lotes após medir. Monitorar atraso da fila, falhas, bytes, duplicatas, latência e custo por milhão de registros.


Arquivo oficial anual 2025 medido: ZIP 5.998.720 bytes; CSV expandido 62.723.068 bytes, 170.615 linhas. SHA-256 ZIP 9a2a43eb0261b0311c48b1f6ed298c64c20107fa20b82a7375718bbd52bf60df. Bytes mantidos privados; POC local usa projeção sem CPF. Não houve movimentação de produção.

## Prova local executada

`scripts/storage-poc.ts` exige banco local isolado com nome engineering. Lê o ZIP verificado, valida colunas e valores e importa a projeção analítica completa em schema analysis. Instalação privada @duckdb/node-api em .tools/analysis, sem dependência no runtime. Linha + hash de arquivo identificam a observação; não se presume identidade equivalente a um lançamento da API. JSON guarda dinheiro como string e PostgreSQL/Parquet usam DECIMAL/NUMERIC(18,2).

| Formato da mesma projeção | Bytes | Tempo mediano de count/sum, 5 repetições locais |
| --- | ---: | ---: |
| CSV | 13.046.084 | 110,18 ms |
| JSON | 21.408.053 | 315,06 ms |
| PostgreSQL com PK | 20.316.160 | 69,38 ms |
| Parquet/Zstandard | 875.620 | 7,96 ms |

Todos recuperaram 170.615 observações e soma exata 214.501.878,24. Dados de resultado em STORAGE_POC_RESULTS.json. SQLs de análise não incluem CPF, nomes de fornecedores ou documentos brutos. Esta comparação não é benchmark de nuvem: máquina única, caches aquecidos, projection parcial de campos, PostgreSQL com índice e arquivos sem PK. Compressão e scan eficiente demonstram utilidade futura; não demonstram segurança de remoção do hot nem substituem a evidência original. Nenhum registro de produção foi arquivado.

Banco atual mantém registros e histórico em PostgreSQL; não há justificativa de particionamento em 21 MB. Preservar índices existentes até observar carga real: os índices GIN trigram/FTS atendem operadores diferentes. O índice parcial collection_ready é novo somente no schema local e foi observado em EXPLAIN do consumidor. JSONB e relações normalizadas devem evoluir por benefício medido. Backups e recuperação estão em BACKUP_RECOVERY.md; destino externo pendente.
