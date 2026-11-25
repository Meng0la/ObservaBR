import assert from 'node:assert/strict'

const base = new URL(process.env.TEST_BASE_URL || 'http://127.0.0.1:3000')
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) {
  throw new Error('O teste HTTP requer a instância local de teste.')
}

async function read(path, expectedStatus = 200) {
  const response = await fetch(new URL(path, base), {signal: AbortSignal.timeout(10000)})
  assert.equal(response.status, expectedStatus, path)
  return response
}

const health = await (await read('/api/health')).json()
assert.equal(health.status, 'ok')
const summary = await (await read('/api/summary')).json()
assert.ok(Number.isInteger(summary.counts.politician))
assert.ok(Array.isArray(summary.jobs))
assert.ok(Array.isArray(summary.states))
const search = await (await read('/api/records?kind=politician&page=1')).json()
assert.ok(search.items.length <= search.pageSize)
assert.ok(search.total >= search.items.length)
for (const item of search.items) {
  assert.match(item.sha256, /^[a-f0-9]{64}$/)
  assert.equal(new URL(item.api_url).hostname, 'dadosabertos.camara.leg.br')
}
const csv = await read('/api/records?format=csv&kind=politician')
assert.match(csv.headers.get('content-type'), /text\/csv/)
assert.match(await csv.text(), /source_url,api_url,sha256/)
await read('/api/records?page=0', 400)
await read('/api/records?from=2020-01-01&to=2019-01-01', 400)
await read('/api/records/politician/registro-inexistente', 404)
console.log('HTTP e PostgreSQL: integridade das fontes, exportação, validação e cobertura verificadas.')
