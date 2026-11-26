# CA pública do Supabase

supabase-prod-ca-2021.crt contém somente o certificado público Supabase Root 2021 CA, sem chave privada. Obtido por HTTPS em 26/11/2026 no endpoint de distribuição https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt.

Fingerprint SHA-256: 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA. Expira em 26/04/2031. Revisar o certificado quando o provedor anunciar rotação.

Docker e workflows adicionam essa CA ao conjunto confiável do Node com NODE_EXTRA_CA_CERTS. As URLs de produção continuam usando sslmode=verify-full, com validação da cadeia e do hostname. Não desabilitar rejectUnauthorized nem usar NODE_TLS_REJECT_UNAUTHORIZED=0. A orientação oficial está em https://supabase.com/docs/guides/platform/ssl-enforcement.
