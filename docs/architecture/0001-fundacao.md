# Primeiro corte vertical
O frontend Vite consome uma API Fastify de mesma origem. O processo Scout possui credencial própria para escrita. A interface continua consultável durante indisponibilidade da Câmara.

O PostgreSQL mantém registros publicados, documentos e revisões numa transação por página. O identificador externo pertence ao conjunto de dados. Os valores financeiros usam NUMERIC e os identificadores são texto. O campo JSONB contém uma projeção de campos públicos específicos de cada registro.

O processo de coleta usa fila persistente e checkpoint de página. Uma única instância coordena o consumo com advisory lock de sessão. Uma recuperação pode reler uma página com segurança. Datas e valores ausentes permanecem nulos. A cobertura representa o acervo local.

O esquema privado também pode ser instalado em PostgreSQL do Supabase. A primeira versão armazena o documento bruto comprimido pelo PostgreSQL, com acesso exclusivo ao coletor. Migrar arquivos grandes para Storage exige política explícita de retenção, integridade e acesso.

HTML e JavaScript de terceiros ficam fora do coletor inicial. A API oficial entrega os registros necessários em JSON.
