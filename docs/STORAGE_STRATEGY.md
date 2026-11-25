# Armazenamento híbrido — planejamento
Hoje todos os registros, documentos e revisões residem em PostgreSQL. Antes de arquivar, medir bytes por tipo, crescimento diário, p95 de consultas, WAL, tempo de backup e custo de restauração.
Hot mantém registros consultados e índices no PostgreSQL. Warm preserva PostgreSQL com índices e eventual particionamento baseado em volume e planos EXPLAIN. Cold prevê Parquet comprimido com Zstandard em R2/S3 e consultas DuckDB.
Cada objeto futuro deverá ter manifesto com origem, SHA-256, coletor, período, esquema e contagem. Arquivamento exige conferência antes de retirar dados do hot, procedimento reversível e teste de restauração. Definir retenção por base legal e finalidade, com acesso restrito ao bruto.
A fila persistente e os checkpoints atuais são por página. Coletas repetidas fazem upsert, mas exclusões na origem e identidade de lançamentos corrigidos exigem conciliação. Planejar ETag/Last-Modified, cache e lotes após medir. Monitorar atraso da fila, falhas, bytes, duplicatas, latência e custo por milhão de registros.

