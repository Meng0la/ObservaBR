# Enriquecimento e projeções públicas de evidência
O Fastify consulta exclusivamente o PostgreSQL para exibir registros. O acionamento público recebe tipo e ID já indexados, com validação estrita, limite de dez pedidos por hora por IP/instância e chave única por entidade. O Scout compartilha o advisory lock do consumidor existente e processa a fila complementar antes da coleta geral. O comando administrativo scripts/enrich.ts usa o mesmo lock.

api_snapshots materializa a projeção publicável de cada resposta. O bruto exato permanece em source_documents, restrito ao writer e deduplicado pelo SHA-256. O identificador do snapshot é derivado de URL e hash. Respostas idênticas conservam o documento. Uma nova versão acrescenta evidência. A revalidação atualiza verified_at sem reescrever collected_at. O cache é de 24 horas. Falhas complementares resultam em contexto parcial e nova tentativa em 30 minutos.

entity_contexts mantém a interpretação atual com referências por campo. enrichment_documents relaciona os snapshots à entidade. As revisões anteriores do registro normalizado continuam em data_revisions. Os snapshots históricos permanecem armazenados. A publicação é transacional após coleta e validação. Uma interrupção pode deixar documentos no cache, que serão reutilizados na retomada.

A listagem mensal não sobrescreve uma votação que já possui contexto complementar. A atualização dessa entidade passa a depender do detalhe homologado, preservando título, origem e contexto coerentes. Os documentos da listagem continuam arquivados.

O registro de recursos admite apenas rotas institucionais específicas com IDs validados. O transporte valida novamente o destino, bloqueia IPs privados, não segue redirecionamentos, aplica timeout, limitação de bytes e intervalo entre chamadas. A configuração explícita de proxy fica sob responsabilidade do operador.

O bruto é interpretado a partir dos bytes recebidos. A projeção remove chaves pessoais, credenciais, nomes de fornecedores individuais identificados por CPF e padrões de identificadores pessoais em texto. Supressões são informadas no JSON Pointer. O hash exibido refere-se à resposta recebida, antes de supressões e da formatação feita pelo visualizador. O leitor do banco acessa somente as projeções publicáveis. Campos ausentes e relações ambíguas permanecem explicitamente indisponíveis.

O Explorer limita cada consulta a 30 documentos e 8 MiB, e sinaliza redução do conjunto. A árvore usa limites próprios de profundidade, nós e resultados. O navegador cria texto e elementos DOM. Links internos só são derivados de identificadores reconhecidos, sem executar HTML da origem.

As proposições afetadas e possíveis objetos têm funções distintas. O texto da abertura e referências inequívocas confirmam a proposição principal. O coletor aprofunda até quatro proposições identificadas, preserva as demais como fichas referenciadas com origem e informa a ausência de detalhes. A API e o frontend permitem solicitar o complemento dessas fichas.

A expansão para outras instituições deverá adicionar registro de recursos, política pública e contratos próprios. Parquet e armazenamento de objetos permanecem no planejamento de STORAGE_STRATEGY.md. Os IDs, hashes, URLs, datas e versão do coletor formam o manifesto necessário para arquivamento futuro.


As referências por campo do contexto carregam o hash do documento específico, para distinguir versões do mesmo endpoint. Mudanças na interpretação são arquivadas em data_revisions com tipo terminado em _context. Na API Explorer, páginas históricas preservam a versão do coletor do registro e indicam separadamente a versão de sua projeção pública.
