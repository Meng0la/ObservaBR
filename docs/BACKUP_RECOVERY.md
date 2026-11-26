# Backup e recuperação

Implementado e ensaiado localmente em 26/11/2026. O mantenedor escolheu explicitamente manter apenas o procedimento preparado por enquanto. Não há destino externo nem agendamento de backup em produção configurados; não provisionar até nova instrução. O ensaio usa uma cópia de engenharia; não é um backup recente da produção. Arquivos privados ficam em .tools ou em volume privado definido pelo operador, nunca no Git, no build, em logs ou em artifacts públicos. O contexto Docker também exclui backups, postgres-data e arquivos de segredo privados.

## Rotina automatizável

`node scripts/backup.ts` executa pg_dump custom consistente apenas do schema observabr, usando login dedicado membro de observabr_backup. A migration de engenharia cria esse grupo NOLOGIN com SELECT e políticas RLS específicas, sem conceder bruto ao reader. A migration ainda não foi aplicada em produção; não reutilizar o writer para contornar esse requisito.

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
