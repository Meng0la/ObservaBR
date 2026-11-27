# Backup e recuperação

Implementado e ensaiado localmente em 26/11/2026. Em 27/11/2026 foi criado e restaurado um backup real recente da produção após autorização explícita. Não há destino externo persistente nem agendamento de backup configurados; não provisionar até nova instrução. Arquivos privados ficam em .tools ou em volume privado definido pelo operador, nunca no Git, no build ou em logs. O contexto Docker também exclui backups, postgres-data e arquivos de segredo privados.

O backup real está cifrado em `.tools/production-backups/observabr-production-20261127.obr`, com manifesto `.json` separado e chave fora desse diretório. O runner serviu somente para criação e transporte temporário: o artefato remoto e a chave temporária foram apagados após download e autenticação. Portanto esta é uma cópia privada local comprovada, não um backup externo ativo nem uma rotina agendada.

## Rotina automatizável

`node scripts/backup.ts` executa pg_dump custom consistente apenas do schema observabr, usando login dedicado membro de observabr_backup. A migration de engenharia, aplicada em produção em 27/11/2026, cria esse grupo NOLOGIN com SELECT e políticas RLS específicas, sem conceder bruto ao reader. O login dedicado ainda precisa de provisionamento privado antes de automatizar a rotina; não reutilizar o writer como configuração permanente.

Configuração por secrets/ambiente: BACKUP_DATABASE_URL, BACKUP_KEY_HEX (32 bytes aleatórios em hexadecimal), BACKUP_DIRECTORY, BACKUP_RETENTION_DAYS (padrão 30) e PG_DUMP_BIN, quando necessário. Para remoto: sslmode=verify-full e CA oficial via PGSSLROOTCERT ou sslrootcert na URI. Use pg_dump compatível com a versão do servidor. Não colocar URI em argumento de shell nem compartilhar senha/chave no chat.

O destino pode ser um volume externo privado montado pelo operador. O código não provisiona armazenamento nem verifica sozinho ACL de um provedor. Antes de agendar, comprovar autenticação, política de acesso privado, quota gratuita, recuperação e persistência independente do runner. Um diretório no disco local ou efêmero do Render não satisfaz backup externo. Nenhum serviço pago foi contratado.

O dump temporário é cifrado com AES-256-GCM e nonce aleatório; chave não fica junto do backup. O manifesto registra horário UTC, algoritmo, hashes do dump e do arquivo cifrado. Uma descriptografia autenticada e comparação dos bytes precedem a retenção. A rotina remove somente nomes próprios de backup antigos e arquivos regulares, após verificar o novo; recusa diretório simbólico. Temporários são privados e removidos no finally; encerramento forçado pode exigir limpeza posterior do diretório temporário privado. Em Windows, o acesso depende também da ACL do diretório, não apenas do modo POSIX.

## Restauração

1. Obter `.obr`, manifesto e chave por canais separados. Conferir encryptedSha256 com fileHash antes de decryptBackup; a função valida cabeçalho e autenticação GCM e remove a saída em falha. Comparar também plainSha256. Não restaurar se qualquer verificação falhar.
2. Criar banco isolado vazio. Preparar grupos observabr_reader, observabr_writer e observabr_backup como NOLOGIN, sem SUPERUSER/BYPASSRLS. Criar schema extensions e extensões pg_trgm/unaccent nesse schema. O dump deste escopo não inclui roles, extensões, senhas, histórico Supabase ou políticas de outros schemas.
3. Executar pg_restore --exit-on-error sobre schema e dados juntos. Preservar ordem de constraints e sequences. Não restaurar somente dados em tabelas ainda inexistentes nem usar reset no projeto remoto. Usar credencial administrativa apenas nesse destino de recuperação.
4. Criar logins independentes e senhas novas fora do versionamento. Reaplicar o bootstrap privado de associação reader/writer, limites de conexão e TLS; conferir funções, search_path, grants, índices, RLS e schemas de extensões. Em Supabase novo, aplicar também os controles de exposição da migration cloud_security; nunca copiar metadados de senha do histórico operacional.
5. Executar tests/database-smoke.sql e contratos HTTP com reader; contar registros/revisões/aliases e verificar SHA-256 dos bytes de source_documents. Comparar schema com scripts/schema-fingerprint.ts. Validar o caso 402/404 e os links de evidência. Troca de destino da aplicação exige autorização própria.

Ensaio real: login de backup separado leu o acervo com RLS; dump cifrado/descriptografado preservou hash; restauração isolada recuperou 3.110 registros, 2.094 revisões, 100 aliases e zero hashes brutos inválidos. Os testes automatizados rejeitam chave diferente e corrupção. Repetir restauração mensalmente e após mudanças de schema; isso é política preparada, sem cron externo ativo.

Restauração de produção de 27/11/2026: como o writer de privilégio mínimo não pode ler o valor interno da sequência, não houve concessão temporária de privilégio. O pacote autenticado contém as cinco migrations do schema vigente, CSVs das nove tabelas autorizadas, ordem explícita de restauração e recomposição da sequência pela maior revisão. A prova recuperou 2.764 registros, 62 documentos, 1.995 revisões, 2.616 jobs, 9/9 tabelas com RLS e zero hashes inválidos. Depois da prova, CSVs, TAR, ZIP e banco isolado foram eliminados; somente `.obr` e manifesto permaneceram.
