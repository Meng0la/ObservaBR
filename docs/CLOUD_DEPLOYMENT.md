# Operação do MVP na nuvem

## Estado de 26/11/2026
Site e API publicados em https://observabr.onrender.com, serviço Render `srv-dc454l15efls73d3i01g`, plano Free, workspace My Workspace confirmado pelo mantenedor. O deploy `dep-dc454l95efls73d3i120` ficou live com o commit 8124696. O PostgreSQL está no Supabase (`ajhvfqqooqamnoqxqnvh`), com nove tabelas importadas e conferidas por contagem/SHA-256. O Scout já executou em runner GitHub-hosted e está agendado. Site, API, banco e processamento complementar operam sem processos locais. A cópia local permanece como backup; nenhum computador foi desligado durante o teste.

Criação feita diretamente pelo MCP do Render, sem Blueprint gerenciado. render.yaml é uma referência recuperável da configuração, não uma autorização para criar serviço duplicado. Não aplicar um novo Blueprint sem escolher explicitamente adoção do serviço existente e revisar o plano. A criação direta disponível não expôs healthCheckPath: o serviço usa a verificação TCP do Render, e /api/health foi validado externamente com acesso real ao banco. A configuração HTTP desse campo no painel é uma melhoria operacional pendente.

## Arquitetura preparada para custo zero
`render.yaml` descreve um único serviço Docker Free que executa Node.js 24.22.3/Fastify e serve o build Vanilla/Vite pela mesma origem. O PostgreSQL permanece no Supabase. O workflow `.github/workflows/scout.yml` executa o Scout em runners padrão do GitHub Actions, sem computador pessoal ou runner próprio. O repositório é público. O serviço existente já está ativo; o tutorial de criação abaixo é referência para recuperação.

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

O host confirmado pelo mantenedor é aws-1-us-west-2.pooler.supabase.com, porta 5432. As URLs prontas estão em `.tools/cloud-migration/runtime-urls.env`, privado. O pooler exige a CA do Supabase, incluída em infrastructure/certs/supabase-prod-ca-2021.crt. Docker e workflows usam NODE_EXTRA_CA_CERTS para confiar na CA pública, mantendo sslmode=verify-full e a validação de hostname. A primeira execução sem essa CA falhou de forma fechada; a configuração foi corrigida e as duas conexões passaram nos runners. As senhas são aleatórias em hexadecimal e não precisam de escapes adicionais. Outros valores exigem URL encoding. O administrador do banco não é usado na aplicação.

## Publicar site e API
1. Instale e conecte o plugin Render com a conta que usará o serviço, ou use o painel Render ligado ao GitHub.
2. Crie um Blueprint a partir de `Meng0la/ObservaBR`, branch `main`, usando `render.yaml`.
3. Confira **plan: free**. Não criar outro banco nem selecionar serviço pago.
4. Configure `DATABASE_URL` com a URL de `observabr_api`, exclusivamente no gerenciador de variáveis do serviço.
5. Aguarde o build Docker e teste `/api/health`, `/api/summary`, diretório, votação, Explorer, exportação e temas no endereço público.

O domínio público https://observabr.onrender.com já foi validado. O repositório possui autoDeploy=yes por commit no serviço; os commits somente de documentação podem usar [skip render]. O gerenciamento das variáveis do serviço continua no Render, com DATABASE_URL exclusiva do reader. Não enviar a conexão writer para esse serviço.

## Ativar o Scout
1. Em GitHub → repositório → Settings → Secrets and variables → Actions, crie o secret `OBSERVABR_SCOUT_DATABASE_URL` com a URL de `observabr_scout`.
2. Execute manualmente **Scout na nuvem** em Actions e confira o resultado e a atualização de uma solicitação real no Supabase.
3. Somente após o teste, crie a variável Actions `OBSERVABR_SCOUT_ENABLED=true` para habilitar o agendamento de quinze minutos.
4. Confirme que nenhum Scout local continua escrevendo. Não remover o acervo/backup local antes de validar o ciclo remoto completo.

O workflow Scout não recebe a senha do reader, a senha do administrador nem `service_role`. Não publica dumps, respostas brutas ou arquivos de credenciais como artifacts. O agendamento pode sofrer atrasos; a interface preserva o estado pendente até o processamento efetivo. A variável OBSERVABR_SCOUT_ENABLED está true e o workflow está active.

O workflow manual `.github/workflows/cloud-check.yml` é separado e usa exclusivamente OBSERVABR_API_DATABASE_URL para verificar reader, TLS real no socket, bloqueio do bruto e contratos Fastify contra o banco remoto. [Execução aprovada](https://github.com/Meng0la/ObservaBR/actions/runs/45850926621). O Scout foi validado novamente após colocar o caso 2520670-66 na fila; o contexto e o job foram atualizados para done pelo runner. [Processamento aprovado](https://github.com/Meng0la/ObservaBR/actions/runs/45851269157). Foram reutilizados os snapshots de fontes já coletadas, conforme a política de cache.

## Limites do gratuito
O Render Free suspende após quinze minutos de inatividade e a primeira abertura pode levar aproximadamente um minuto. Não executar pings artificiais para evitar essa suspensão. Existe franquia de horas, tráfego e build; usar limites de gasto zero e não habilitar upgrades automáticos. [Condições oficiais](https://render.com/docs/free).

Runners padrão do GitHub são gratuitos para repositórios públicos. O agendamento não oferece SLA e pode ser desativado pelo GitHub após inatividade do repositório. [Cobrança](https://docs.github.com/en/actions/concepts/billing-and-usage).

O banco remoto medido após a importação ocupa aproximadamente 20,7 MB, incluindo estruturas internas. O crescimento, a franquia do projeto, backups e eventual suspensão por inatividade precisam ser acompanhados no painel. Não há backup externo automático configurado nesta etapa. O backup anterior à transferência está em `.tools/cloud-migration/pre-transfer.dump`, privado e local.

## Migrations e recuperação
As migrations 001 e 002 foram aplicadas manualmente pelo mantenedor, sem registro no histórico remoto. A 003 foi aplicada nesta tarefa, seguida de `cloud_security`, que move as extensões para `extensions` e restringe a função opcional de evento de RLS. A criação dos logins foi uma operação de bootstrap com segredos, sem arquivo público com senhas.

Não executar replay cego nem `db push` antes de reconciliar o histórico remoto com os arquivos locais. O deploy da aplicação não executa migrations automaticamente. O banco local foi preservado e recebeu a mesma migration de segurança. O bundle privado de importação não deve ser publicado.

Para repetir uma transferência controlada, `DATABASE_URL` de administrador aponta para o banco de origem e `node scripts/export-supabase.ts` gera um snapshot consistente em `.tools/cloud-migration`. O script preserva o JSON textual produzido pelo PostgreSQL, sem arredondar NUMERIC ou bigint em JavaScript. A comparação ordena JSONB com collation C, usa UTC e verifica SHA-256 de todas as tabelas, além do hash de cada documento bruto. Conflitos de chave são preservados na importação; a comparação integral deve detectar qualquer divergência antes da virada.

O backup custom foi restaurado integralmente em banco isolado: extensões pg_trgm/unaccent instaladas antes do restore, schema e dados restaurados juntos e migration de segurança aplicada em seguida. Foram conferidos 2.762 registros, 1.994 revisões e zero hashes brutos inválidos. Não usar pg_restore --data-only sem ordenar dependências ou sem tratar constraints: a ordem do arquivo integral pressupõe que as FKs sejam criadas depois dos dados. Um cluster novo também precisa dos grupos reader/writer antes de restaurar suas permissões. O banco de teste temporário foi removido após a validação.

A migração operacional foi validada com conexões próprias reais, URL pública, smokes HTTP, Chrome e processamento do Scout no GitHub. Execute `node tests/public-smoke.mjs` para repetir a verificação de leitura pública. Em redes corporativas, Node pode precisar de --use-system-ca e --use-env-proxy, sem desativar TLS. As capturas locais estão em .tools/cloud-migration/screens, com ambos os temas, 390/1440 px e inspeção do mapa visível no celular. Nenhuma instância de API, Scout ou PostgreSQL no computador é usada pelo serviço publicado.
