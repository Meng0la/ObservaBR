import test from 'node:test'
import assert from 'node:assert/strict'
import type pg from 'pg'
import {app,csv} from '../apps/api/app.ts'

test('a API rejeita período invertido e tipos desconhecidos antes de consultar o banco',async()=>{
  const api=await app({} as pg.Pool)
  try {
    for(const url of ['/api/records?from=2025-02-01&to=2025-01-01','/api/records?kind=invalid','/api/records?page=0',
      '/api/records?sort=amount','/api/records?sort=name-asc%20nulls%20first','/api/records?party=%20']) {
      assert.equal((await api.inject(url)).statusCode,400)
    }
    assert.equal((await api.inject({url:'/api/requests',method:'POST',payload:{name:'https://example.org/'}})).statusCode,400)
    const headers=(await api.inject('/api/records?page=-1')).headers
    assert.ok(headers['content-security-policy'])
    assert.equal(headers['access-control-allow-origin'],undefined)
  } finally {await api.close()}
})
test('partido é um parâmetro e a ordenação explícita substitui a relevância textual',async()=>{
  const calls:{sql:string,args:unknown[]}[]=[]
  const api=await app({query:async(sql:string,args:unknown[])=>{
    calls.push({sql,args:[...args]})
    return {rows:sql.startsWith('select count')?[{total:0}]:[]}
  }} as unknown as pg.Pool)
  try {
    const party="V' UNION SELECT"
    const query='/api/records?q=busca&party='+encodeURIComponent(party)
    assert.equal((await api.inject(query)).statusCode,200)
    assert.match(calls[1].sql,/order by word_similarity/)
    assert.ok(calls[1].args.includes(party))
    assert.ok(!calls[1].sql.includes(party))
    assert.equal((await api.inject(query+'&sort=amount-asc')).statusCode,200)
    assert.match(calls[3].sql,/order by amount asc nulls last,title,kind,id/)
    assert.doesNotMatch(calls[3].sql,/order by word_similarity/)
  } finally {await api.close()}
})
test('CSV preserva aspas e neutraliza fórmulas',()=>{
  assert.match(csv([{title:'="x"'}]),/"'=""x"""/)
})

