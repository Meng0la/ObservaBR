# Consulta do diretório

## GET /api/records

O diretório aceita os filtros existentes de texto, tipo, responsável, votação, UF e intervalo de datas. O tamanho de página continua em 25 registros. As exportações JSON e CSV acompanham os mesmos filtros, ordenação e página.

| Parâmetro | Valores | Comportamento |
| --- | --- | --- |
| `party` | Sigla presente em `/api/summary.parties` | Correspondência exata com a sigla do perfil local ou com a sigla do perfil identificado em `owner`. |
| `sort` | `name-asc`, `name-desc` | Ordena o título ignorando caixa e acentos. |
| `sort` | `date-asc`, `date-desc` | Ordena a data documental disponível. |
| `sort` | `amount-asc`, `amount-desc` | Ordena o valor numérico em reais. |

O partido reflete o perfil parlamentar disponível no índice. Atribuir um lançamento a uma filiação na data do evento exige histórico partidário próprio. Registros sem perfil indexado para o responsável ficam fora do filtro de partido. O servidor aplica todos os filtros em conjunto e usa parâmetros SQL para os valores recebidos.

Valores ausentes ficam no fim da lista, em ambos os sentidos. Título, tipo e ID desempatarão registros com a mesma chave de ordenação. A busca textual sem ordenação explícita prioriza relevância e usa data decrescente como desempate. A listagem sem busca ou ordenação começa pela data mais recente. Ordenação desconhecida, partido vazio ou intervalo invertido retornam HTTP 400.

Exemplo de consulta para a sigla escolhida no diretório:

```js
const params = new URLSearchParams({ kind: 'politician', party: selectedParty, sort: 'name-asc' })
const response = await fetch('/api/records?' + params)
```

## GET /api/summary

| Campo | Origem e significado |
| --- | --- |
| `parties` | Array ordenado de siglas distintas dos perfis parlamentares indexados, excluídos valores ausentes e vazios. |
| `periods` | Array de objetos `{kind, from, to}` por tipo presente no índice. As datas extremas vêm da coluna documental `records.date`, no formato `YYYY-MM-DD`. Quando todos os registros daquele tipo carecem de data, ambos os limites são `null`. |
| `counts.proposal` | Quantidade de proposições distintas, identificadas por `data.proposalId` ou, nos registros antigos sem esse campo, pelo ID do registro. |
| `counts.proposalLinks` | Quantidade de registros de proposição que identificam um autor em `owner`. Coautorias contribuem com um vínculo por autor indexado. |

Os limites em `periods` descrevem o conteúdo presente na base. A densidade de registros ao longo do intervalo pode variar. O campo preexistente `coverage` continua descrevendo as tarefas operacionais por fonte e ano de coleta.
