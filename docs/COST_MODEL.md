# Modelo de custos — planejamento
Nenhuma infraestrutura foi contratada nesta fase. Não há estimativa monetária verificada de fornecedores.
Medir separadamente compute da API, horas do worker, banco e índices, armazenamento bruto, backups, logs, requisições e transferência.
Custo mensal = compute + banco + GB-mês de objetos e backups + operações + transferência + observabilidade.
Projetar cenários a partir de registros/dia, bytes/registro, revisões/dia, requisições/minuto e retenção. Incluir custo de restauração e atualização dos históricos.
Alertas sugeridos devem ter orçamento definido pelo mantenedor. Revisar planos e preços oficiais antes de qualquer contratação. Redis e embeddings dependem de justificativa medida.

