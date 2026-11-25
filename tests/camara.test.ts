import test from 'node:test'
import assert from 'node:assert/strict'
import { collectionUrl, collect, parsePage, type Task } from '../packages/collectors/camara/index.ts'

const expenses: Task = { kind: 'expense', owner: '123', year: 2025 }
function page(task: Task, dados: unknown[], links: unknown[] = []) {
  const url = collectionUrl(task).href
  return parsePage(Buffer.from(JSON.stringify({ dados, links })), task, 1, url)
}

test('aceita só identificadores institucionais e constrói destinos fixos', () => {
  assert.throws(() => collectionUrl({ ...expenses, owner: 'https://127.0.0.1' }))
  assert.throws(() => collectionUrl({ kind: 'ballot', owner: '../votacoes', year: 2025 }))
  assert.throws(() => collectionUrl({ kind: 'vote', year: 2025, month: 13 }))
  const url = collectionUrl({ kind: 'politician', name: 'Maria & João', year: 2025 })
  assert.equal(url.searchParams.get('nome'), 'Maria & João')
  assert.equal(url.hostname, 'dadosabertos.camara.leg.br')
  assert.equal(collectionUrl({ kind: 'vote', year: 2024, month: 2 }).searchParams.get('dataFim'), '2024-02-29')
})

test('preserva estorno, diferencia crédito e débito e oculta fornecedor pessoa física', () => {
  const row = { tipoDespesa: 'Categoria de teste', codDocumento: '9', valorDocumento: 50.25, valorLiquido: -50.25,
    cnpjCpfFornecedor: '00000000000', nomeFornecedor: 'Pessoa de teste', urlDocumento: 'https://localhost/doc',
    dataDocumento: null, ano: 2025, mes: 1 }
  const result = page(expenses, [row, { ...row, valorLiquido: 50.25 }])
  const [debit, credit] = result.records
  assert.notEqual(debit.id, credit.id)
  assert.equal(debit.date, null)
  assert.equal(debit.amount, '-50.25')
  assert.equal(debit.sourceUrl, result.url)
  assert.equal(debit.data.supplier, null)
  assert.equal(debit.field, '/dados/0')
  assert.equal(JSON.stringify(result.records).includes(row.cnpjCpfFornecedor), false)
  assert.equal(page(expenses, [row]).records[0].id, debit.id)
  const reused = page(expenses, [
    { ...row, dataDocumento: '2025-01-02T00:00:00' },
    { ...row, dataDocumento: '2025-01-03T00:00:00' }
  ])
  assert.notEqual(reused.records[0].id, reused.records[1].id)
  assert.throws(() => page(expenses, [row, row]), /ambíguas/)
})

test('mantém coautorias e preserva o voto registrado sem inferir ausências', () => {
  const proposal = { id: 22, numero: 7, ano: 2025, siglaTipo: 'REQ', ementa: 'Exemplo de teste' }
  const a = page({ kind: 'proposal', owner: '123', year: 2025 }, [proposal]).records[0]
  const b = page({ kind: 'proposal', owner: '124', year: 2025 }, [proposal]).records[0]
  assert.notEqual(a.id, b.id)
  assert.equal(a.data.proposalId, b.data.proposalId)
  const ballot: Task = { kind: 'ballot', owner: '100-2', year: 2025 }
  assert.equal(collectionUrl(ballot).search, '')
  assert.deepEqual(page(ballot, []).records, [])
  const record = page(ballot, [{ tipoVoto: 'Obstrução', deputado_: { id: 123, nome: 'Pessoa de teste' } }]).records[0]
  assert.equal(record.title, 'Obstrução')
  assert.equal(record.owner, '123')
  assert.equal(record.data.voteId, '100-2')
  assert.throws(() => page(ballot, [{ tipoVoto: 'Sim' }]))
})

test('contrato oficial ao vivo: cinco recursos e resposta nominal', { skip: !process.env.OBSERVABR_LIVE }, async () => {
  const tasks: Task[] = [
    { kind: 'politician', year: 2025 },
    { kind: 'expense', owner: '204379', year: 2025 },
    { kind: 'proposal', owner: '204379', year: 2025 },
    { kind: 'vote', year: 2025, month: 12 },
    { kind: 'ballot', owner: '2520670-66', year: 2025 }
  ]
  for (const task of tasks) {
    const generator = collect(task)
    try {
      const first = await generator.next()
      assert.ok(!first.done && first.value.records.length > 0, task.kind)
      assert.ok(first.value.raw.byteLength > 0)
      assert.ok(first.value.records.every(record => record.sourceUrl.startsWith('https://')))
    } finally { await generator.return() }
  }
})
