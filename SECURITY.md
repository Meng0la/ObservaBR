# Segurança operacional
Comunique falhas por um canal privado do mantenedor. Ao informar um incidente, envie versão, rota afetada e impacto observado. Remova tokens e identificadores pessoais dos anexos.

O banco privado conserva documentos originais que podem conter dados pessoais. Somente operadores autorizados devem ter acesso aos documentos e backups. A publicação usa projeções explícitas. Rotacione separadamente os logins da API e do Scout e configure TLS ao usar banco remoto.

A aplicação aceita pedidos por nome. O serviço só consulta os recursos da Câmara definidos no código. O limite de solicitações HTTP é por instância. Dimensione limites globais no proxy antes de operar réplicas públicas.

Consulte também docs/THREAT_MODEL.md.
