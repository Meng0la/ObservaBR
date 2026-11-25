# Coleta da Câmara dos Deputados

O conector lê JSON por HTTPS com o cabeçalho `Accept: application/json`. A consulta é pública. A tabela descreve o recorte implementado e o identificador usado para associar cada registro. [Documentação da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html).

| Recurso oficial | Recorte | Identificação |
| --- | --- | --- |
| `/deputados` | Listagem retornada no momento da coleta, com filtro opcional por nome | ID institucional da Câmara |
| `/deputados/{id}/despesas` | CEAP por deputado e ano | Chave composta do lançamento, incluindo deputado, competência, data documental, documento, lote, parcela, ressarcimento e natureza do ajuste |
| `/proposicoes` | Ano, com filtro de autoria por deputado | ID de proposição e ID de autor, preservando coautorias |
| `/votacoes` | Um mês civil por tarefa | ID de votação, órgão, objeto e descrição oficiais |
| `/votacoes/{id}/votos` | Todos os registros nominais retornados para a votação | ID da votação, ID de deputado e horário do registro quando disponível |

As rotas são relativas a [Dados Abertos da Câmara](https://dadosabertos.camara.leg.br/api/v2/). O identificador eleitoral do TSE e o ID da Câmara pertencem a cadastros distintos. A listagem dos deputados reflete o momento da consulta mesmo quando o ano de despesas solicitado é histórico.

## Valores, documentos e cobertura

O campo monetário principal reproduz `valorLiquido` em reais, inclusive ajustes negativos. O registro guarda separadamente o valor documental e a glosa. O campo `mes` representa a competência informada na CEAP, que pode diferir da data do documento. Fornecedores só são exibidos quando a resposta identifica um CNPJ de 14 dígitos. O documento consultável aponta para a publicação institucional ou para a página da API que contém o registro. O campo `field` identifica a posição no JSON da página arquivada.

Alguns lançamentos carecem de código documental individual. Para esses registros, a chave incorpora a competência, a data e o valor. Uma alteração na combinação publicada pode gerar nova identidade. Chaves ambíguas na mesma página interrompem a importação daquela página para análise. A conciliação entre páginas e a retirada de lançamentos excluídos posteriormente na origem requerem auditoria complementar antes de interpretar totais históricos como definitivos.

A categoria de proposição e o texto sobre o objeto efetivamente votado vêm em campos distintos. Uma decisão sobre um requerimento pode referenciar uma proposição principal. Em votações sem lista nominal, o coletor registra a lista vazia. A fonte pode conservar mais de um registro de voto por deputado. O horário original é preservado na identificação.

## Acesso e testes

As requisições ordinárias são espaçadas em pelo menos 1,5 s por processo. O conector limita a resposta a 6 MiB, exige JSON, valida o IP de destino, recusa redirecionamentos e aplica timeout de 30 s por tentativa. Os erros transitórios recebem até duas novas tentativas e o trabalhador registra a falha persistente. Para uma rede que exige proxy, o operador pode configurar `OBSERVABR_HTTPS_PROXY` no ambiente do worker. O proxy deve permitir o túnel ao domínio institucional e aplicar restrições de saída sobre sua própria resolução DNS. Para certificados de uma autoridade institucional confiável, o Node suporta `NODE_USE_SYSTEM_CA=1`.

Os testes locais com fixtures são executados por `npm test`. Com `OBSERVABR_LIVE=1` o contrato consulta uma página real de cada um dos cinco recursos. No Windows PowerShell, a configuração usada em uma rede com proxy foi:

```powershell
$env:OBSERVABR_HTTPS_PROXY = $env:HTTPS_PROXY
$env:NODE_USE_SYSTEM_CA = '1'
$env:OBSERVABR_LIVE = '1'
node --test tests/camara.test.ts
```

O contrato confirmou a estrutura das cinco respostas, incluindo despesas e proposições do deputado 204379 em 2025 e os votos da votação 2520670-66. O endpoint nominal recusou parâmetros de paginação e retornou a lista integral sem esses parâmetros. [Votos na publicação original](https://dadosabertos.camara.leg.br/api/v2/votacoes/2520670-66/votos).
