# Modelo de ameaças
Nesta etapa, conciliação exige dry-run verificável por hash, conferência de evidências/NUMERIC e autorização operacional para produção. Colisão de destino aborta sem excluir registros; aliases mantêm links e histórico anterior. O advisory lock é compartilhado com o Scout. Métricas do Advisor são apenas um controle entre outros, não prova de ausência de vulnerabilidades.

A fronteira pública termina na API de leitura e no acionamento controlado de trabalhos. Só o worker acessa a Câmara. Um parâmetro de usuário nunca escolhe o host de coleta. Consultas SQL usam parâmetros. A interface trata títulos externos como texto.

A projeção pública omite o documento bruto, dados pessoais de fornecedores individuais e credenciais. Os documentos podem conter dados pessoais e exigem controle de acesso nos backups e política de retenção na operação.

Falhas de rede ou de contrato interrompem o trabalho e preservam a última página confirmada. Duplicatas são resolvidas por chave institucional. A cadeia de evidências verifica o conteúdo coletado por SHA-256. Esse hash não certifica a exatidão da declaração da instituição.

Antes de operação pública, verificar TLS, cabeçalhos no proxy, isolamento de saída do worker, orçamento global da fila, restauração de backups, tratamento de correções e expurgo de dados. Qualquer futuro provedor de IA deverá usar consultas previamente definidas, citações validadas no índice e conteúdo externo sem autoridade de instrução.

## Pendências identificadas na Fase 01
Fila com prioridade fixa pode atrasar tipos de coleta. O limite de pedidos HTTP por instância exige orçamento global antes de exposição pública. Falhas de identidade documental podem interromper páginas. Backups e bruto exigem política de retenção e restauração testada. O esquema privado não possui cadastro nacional completo nem associação judicial homologada. Validar resolução e restrições de saída do proxy configurado pelo operador. CI e scanners configurados requerem execução verificável no ambiente de publicação.

## API Explorer
A API não recebe URLs externas para consulta. O visitante solicita apenas entidades previamente indexadas. O Scout valida recurso, ID, domínio e IP no transporte. Respostas têm limite de 6 MiB por chamada e o Explorer limita a seleção publicada a 8 MiB e 30 documentos. O bruto é restrito ao coletor. A projeção pública sinaliza supressões e a árvore JSON usa texto DOM com limites de complexidade. Hash original e exportação formatada são identificados separadamente. Autorização de novos tipos de fonte depende de revisão da política de publicação.

Lotes gerais passam a ter orçamento, dead-letter e quarentena restrita. Arquivo anual é tratado como entrada não confiável: limite de ZIP/expansão, CRC, nomes de membros restritos e destino institucional fixo; não se extraem nomes arbitrários para o filesystem. Divergência entre fontes não autoriza sobrescrever valores financeiros. Comparações da conciliação usam projeção publicável e mensagens sem valores pessoais.

Backup usa grupo NOLOGIN dedicado com leitura RLS, separado de reader/writer. Dump temporário privado, AES-256-GCM, chave externa, hashes e retenção restrita a nomes próprios. Restauração isolada comprovada; destino externo/ACL ainda não configurados. Não habilitar coleta ou db push pelo simples alinhamento do histórico. Zero alertas do Advisor não comprova ausência de vulnerabilidades. Detalhes e limites em BACKUP_RECOVERY.md.
