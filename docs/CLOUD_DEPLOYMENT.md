# Operação do MVP na nuvem

## Estado de 26/11/2026
O banco já foi migrado para o projeto Supabase ObservaBR (`ajhvfqqooqamnoqxqnvh`). Os dados de nove tabelas foram conferidos por contagem e SHA-256. A publicação de site/API e a ativação do Scout dependem da conexão com a hospedagem e da configuração dos secrets descritos abaixo. A operação ainda não foi validada com o computador desligado.

## Arquitetura preparada para custo zero
`render.yaml` define um único serviço Docker Free que executa Node.js 24.22.3/Fastify e serve o build Vanilla/Vite pela mesma origem. O PostgreSQL permanece no Supabase. O workflow `.github/workflows/scout.yml` executa o Scout em runners padrão do GitHub Actions, sem computador pessoal ou runner próprio. O repositório é público.

O Scout executa somente complementos neste MVP, como o consumidor local anterior. Não retoma automaticamente a conciliação financeira nem amplia a cobertura geral. A fila geral importada permanece preservada. Cada execução processa até três entidades, verifica o orçamento de 180 segundos entre entidades e termina ao esvaziar a fila. Uma entidade em andamento pode ultrapassar esse orçamento. O comando externo aplica limite de cinco minutos, com 30 segundos para encerramento. O advisory lock existente continua impedindo consumidores simultâneos. Falhas mantêm o reagendamento de 30 minutos.

Cloudflare Pages continua sendo o destino previsto para publicação estática separada. Neste recorte, o próprio Fastify já serve o site, reduzindo as contas necessárias para ativar o MVP. Nenhuma conta Cloudflare foi conectada e nenhum recurso Cloudflare foi criado. Workers e Edge Functions não receberam uma adaptação dos coletores Node: o transporte institucional usa DNS, HTTPS e controles de destino já validados. Docker/Compose continuam disponíveis para desenvolvimento e eventual servidor dedicado.

## Conexões e credenciais
Os logins remotos `observabr_api` e `observabr_scout` usam senhas distintas, sem superusuário, criação de roles/bancos, replicação ou bypass de RLS. Os limites são oito e três conexões, respectivamente. A API recebe apenas o grupo reader e o Scout recebe writer. A API não pode ler `source_documents`. `anon` e `authenticated` não têm USAGE no schema `observabr`.

O endereço oficial deve ser obtido em [Connect → Session pooler](https://supabase.com/dashboard/project/ajhvfqqooqamnoqxqnvh?showConnect=true&method=session). Copie o host fornecido pelo painel, sem deduzi-lo a partir da região. Use porta 5432 e modo **Session**, pois o Scout mantém um advisory lock de sessão. Não usar o pooler de transação da porta 6543 para o Scout. Exigir TLS com validação do certificado; não usar `rejectUnauthorized:false`.

As senhas geradas estão somente em `.tools/cloud-migration/service-credentials.env`, ignorado pelo Git e pelo Docker. Não cole esse arquivo em conversas, issues ou documentação pública. A URL de cada serviço usa seu próprio login; em conexões pelo pooler, o usuário inclui o sufixo do projeto:

```text
postgresql://observabr_api.ajhvfqqooqamnoqxqnvh:[READER_PASSWORD]@[HOST_OFICIAL]:5432/postgres?sslmode=verify-full
postgresql://observabr_scout.ajhvfqqooqamnoqxqnvh:[WRITER_PASSWORD]@[HOST_OFICIAL]:5432/postgres?sslmode=verify-full
```

Se o certificado exigir uma CA adicional, configurar o certificado oficial antes da ativação. As senhas são aleatórias em hexadecimal e não precisam de escapes adicionais. Outros valores exigem URL encoding. O administrador do banco não é usado na aplicação.

## Publicar site e API
1. Instale e conecte o plugin Render com a conta que usará o serviço, ou use o painel Render ligado ao GitHub.
2. Crie um Blueprint a partir de `Meng0la/ObservaBR`, branch `main`, usando `render.yaml`.
3. Confira **plan: free**. Não criar outro banco nem selecionar serviço pago.
4. Configure `DATABASE_URL` com a URL de `observabr_api`, exclusivamente no gerenciador de variáveis do serviço.
5. Aguarde o build Docker e teste `/api/health`, `/api/summary`, diretório, votação, Explorer, exportação e temas no endereço público.

Não há domínio público validado nesta entrega. O site e a API devem ser testados pelo endereço que o provedor efetivamente atribuir.

## Ativar o Scout
1. Em GitHub → repositório → Settings → Secrets and variables → Actions, crie o secret `OBSERVABR_SCOUT_DATABASE_URL` com a URL de `observabr_scout`.
2. Execute manualmente **Scout na nuvem** em Actions e confira o resultado e a atualização de uma solicitação real no Supabase.
3. Somente após o teste, crie a variável Actions `OBSERVABR_SCOUT_ENABLED=true` para habilitar o agendamento de quinze minutos.
4. Confirme que nenhum Scout local continua escrevendo. Não remover o acervo/backup local antes de validar o ciclo remoto completo.

O workflow não recebe a senha do reader, a senha do administrador nem `service_role`. Não publica dumps, respostas brutas ou arquivos de credenciais como artifacts. O agendamento pode sofrer atrasos; a interface preserva o estado pendente até o processamento efetivo.

## Limites do gratuito
O Render Free suspende após quinze minutos de inatividade e a primeira abertura pode levar aproximadamente um minuto. Não executar pings artificiais para evitar essa suspensão. Existe franquia de horas, tráfego e build; usar limites de gasto zero e não habilitar upgrades automáticos. [Condições oficiais](https://render.com/docs/free).

Runners padrão do GitHub são gratuitos para repositórios públicos. O agendamento não oferece SLA e pode ser desativado pelo GitHub após inatividade do repositório. [Cobrança](https://docs.github.com/en/actions/concepts/billing-and-usage).

O banco remoto medido após a importação ocupa aproximadamente 20,7 MB, incluindo estruturas internas. O crescimento, a franquia do projeto, backups e eventual suspensão por inatividade precisam ser acompanhados no painel. Não há backup externo automático configurado nesta etapa. O backup anterior à transferência está em `.tools/cloud-migration/pre-transfer.dump`, privado e local.

## Migrations e recuperação
As migrations 001 e 002 foram aplicadas manualmente pelo mantenedor, sem registro no histórico remoto. A 003 foi aplicada nesta tarefa, seguida de `cloud_security`, que move as extensões para `extensions` e restringe a função opcional de evento de RLS. A criação dos logins foi uma operação de bootstrap com segredos, sem arquivo público com senhas.

Não executar replay cego nem `db push` antes de reconciliar o histórico remoto com os arquivos locais. O deploy da aplicação não executa migrations automaticamente. O banco local foi preservado e recebeu a mesma migration de segurança. O bundle privado de importação não deve ser publicado.

Para repetir uma transferência controlada, `DATABASE_URL` de administrador aponta para o banco de origem e `node scripts/export-supabase.ts` gera um snapshot consistente em `.tools/cloud-migration`. O script preserva o JSON textual produzido pelo PostgreSQL, sem arredondar NUMERIC ou bigint em JavaScript. A comparação ordena JSONB com collation C, usa UTC e verifica SHA-256 de todas as tabelas, além do hash de cada documento bruto. Conflitos de chave são preservados na importação; a comparação integral deve detectar qualquer divergência antes da virada.

O backup custom foi restaurado integralmente em banco isolado: extensões pg_trgm/unaccent instaladas antes do restore, schema e dados restaurados juntos e migration de segurança aplicada em seguida. Foram conferidos 2.762 registros, 1.994 revisões e zero hashes brutos inválidos. Não usar pg_restore --data-only sem ordenar dependências ou sem tratar constraints: a ordem do arquivo integral pressupõe que as FKs sejam criadas depois dos dados. Um cluster novo também precisa dos grupos reader/writer antes de restaurar suas permissões. O banco de teste temporário foi removido após a validação.

O encerramento da migração operacional exige URL pública aprovada nos smokes, credenciais próprias testadas por conexão real e uma execução comprovada do Scout no GitHub. Banco remoto e arquivos de configuração, isoladamente, não demonstram independência completa do computador.
