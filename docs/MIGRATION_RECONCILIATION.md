# Histórico reconciliado — 26/11/2026

Projeto exclusivamente ajhvfqqooqamnoqxqnvh. Nenhum reset, reaplicação de schema ou conciliação financeira remota. Comparados banco local preservado, catálogo remoto e migrations: 61 colunas, 25 constraints, 21 índices, uma função, 18 políticas, nove tabelas com RLS e 33 grants dos grupos. Hashes por componente coincidem após normalizar CRLF da função e qualificação redundante de REFERENCES observabr no catálogo. O script schema-fingerprint.ts reproduz a comparação; não inclui passwords, dados ou statements privados do bootstrap remoto.

| Arquivo anterior | Versão canônica | Ação |
| --- | --- | --- |
| 202611250001_core | 20261125000100_core | Baseline manual já existente; inserido somente registro de histórico com comentário de auditoria. |
| 202611250002_observacoes | 20261125000200_observacoes | Mesmo procedimento, sem repetir backfill. |
| 202611260003_enrichment | 20261126114431_enrichment | Nome local alinhado ao registro remoto aplicado. |
| Bootstrap operacional privado | 20261126115334_cloud_service_roles | Representação versionada sanitizada; sem senha e sem criar logins em instalação nova. |
| 20261126115704_cloud_security | 20261126115831_cloud_security | Nome local alinhado ao registro remoto aplicado. |
| Nova engenharia | 20261126160503_data_engineering | Pendente no remoto; validada somente em bancos isolados. |

As duas entradas de baseline foram registradas em transação com o lock comum e verificação de que a estrutura não mudou desde a auditoria. Conferência posterior mostrou exatamente as cinco versões canônicas históricas no remoto. As versões representam os artefatos; não afirmam o horário real da execução manual original. A mudança foi restrita a supabase_migrations.schema_migrations. Código e dados publicados não foram alterados.

Fingerprints MD5 de comparação de catálogo (não evidências de documentos): columns c071e5d6c9e30ae8ea2b95c9565b61f6; constraints 054e8161e579f635c32dc4156aae66e0; functions fcbef780236cd17c0a0b66f67907df38; group_grants b2bb4431e5af762830d7af31b8d092a7; indexes 89803a06f08729319100b9dd8e2f1ab2; policies 0d9a57826a2758cf246d06aebd311ef8; rls e02b177180359f4ee7b90be9ea4c2ef4.

Todas as migrations canônicas passaram em banco local vazio, com 17 tabelas ObservaBR sob RLS. Permissões conferidas: reader sem SELECT no bruto, backup com SELECT e writer autorizado nos aliases. O bootstrap Docker continua criando logins com passwords externas e limites reader 8/writer 3. Não há db push automático configurado. Antes de aplicar a nova migration em produção, repetir fingerprint, backup externo e revisão operacional; o runtime desta branch exige o schema novo.
