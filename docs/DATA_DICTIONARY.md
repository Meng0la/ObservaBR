# Dicionário implementado
| Tabela | Conteúdo e identidade |
|---|---|
| records | PK kind,id. owner é ID de deputado quando aplicável. title, date, amount NUMERIC(18,2), data JSONB, source_url, api_url, field, sha256, collected_at, verified_at, collector_version e search_text. |
| source_documents | PK sha256 de 64 caracteres, raw BYTEA e collected_at. Documento privado. |
| data_revisions | revision sequencial, kind,id,previous JSONB,changed_at. Snapshot anterior. |
| collection_jobs | key derivada da tarefa, kind,task JSONB,page,status,updated_at,due_at,error,priority. |
| collection_requests | UUID, nome pesquisado, status, requested_at e job_key. |

kind admite politician, expense, proposal, vote e ballot. amount reproduz o líquido CEAP, incluindo estorno. date representa a data fornecida pelo recurso, sem inferir publicação. Valores ausentes permanecem nulos. data varia conforme o tipo e está descrito em CAMARA.md.
Não há cadastro nacional normalizado completo. UF de despesa é a representação do autor e requer cuidado ao interpretar distribuição territorial.


## Migração 003
api_snapshots conserva id derivado de URL/hash, recurso, identificador, URL da API, hash original, payload público, indicador original, caminhos suprimidos, datas e versão.
enrichment_jobs usa chave kind/external_id, status, próxima tentativa, atualização e erro operacional. A entidade deve existir em records.
entity_contexts mantém a interpretação atual e referências por campo.
enrichment_documents relaciona entidades e snapshots. Todos os novos conjuntos possuem RLS, leitura pública limitada às projeções e escrita pelo coletor.
