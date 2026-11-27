import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomInt,createHash} from 'node:crypto'
import pg from 'pg'
import {collectionUrl,parsePage} from '../packages/collectors/camara/index.ts'
import {persist,enqueue,jobKey} from '../packages/scout/store.ts'
import {expensePlan,applyExpensePlan,decimalEqual} from '../packages/scout/expense-reconciliation.ts'
import {app} from '../apps/api/app.ts'

test('mesmo código fiscal representa despesas distintas com data, competência ou ressarcimento diferentes',()=>{
 assert.ok(decimalEqual('9007199254740993.21','09007199254740993.21'))
 assert.ok(decimalEqual('-0.00','0'))
 assert.ok(!decimalEqual('0.01','0.02'))
 assert.ok(!decimalEqual(null,'0'))
 const task={kind:'expense' as const,owner:'123',year:2025}
 const row={codDocumento:9,codLote:7,numDocumento:'TESTE',tipoDespesa:'Despesa de teste',ano:2025,mes:1,dataDocumento:'2025-01-01',valorLiquido:10}
 const rows=[row,{...row,dataDocumento:'2025-02-01'},{...row,mes:2},{...row,numRessarcimento:2}]
 const page=parsePage(Buffer.from(JSON.stringify({dados:rows,links:[]})),task,1,collectionUrl(task).href)
 assert.equal(new Set(page.records.map(r=>r.id)).size,4)
})
test('dry-run não altera valores; apply exige plano, preserva histórico, aliases e idempotência', {skip:!process.env.TEST_DATABASE_URL},async()=>{
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path=observabr,public,extensions -c timezone=UTC'})
 const db=await pool.connect()
 const task={kind:'expense' as const,owner:String(randomInt(100000000,999999999)),year:2025}
 const url=collectionUrl(task).href
 const raw=Buffer.from(JSON.stringify({dados:[{codDocumento:7,tipoDespesa:'Categoria teste',ano:2025,mes:1,valorLiquido:-10,valorDocumento:10,valorGlosa:0,dataDocumento:'2025-01-01',cnpjCpfFornecedor:'12345678000100',nomeFornecedor:'Fornecedor de teste '+('0'.repeat(11))}],links:[]}))
 const page=parsePage(raw,task,1,url),canonical=page.records[0].id,old=createHash('sha256').update('legacy-'+task.owner).digest('hex')
 try {
  await enqueue(db,task)
  await persist(db,jobKey(task),task,page)
  await db.query('begin')
  await db.query("update records set id=$2 where kind='expense' and id=$1",[canonical,old])
  const plan=await expensePlan(db,task.owner,2025)
  assert.equal(plan.changes.length,1)
  assert.equal((await db.query("select count(*)::int as n from records where id=$1",[old])).rows[0].n,1)
  await assert.rejects(applyExpensePlan(db,plan,'0'.repeat(64)),/Plano alterado/)
  await assert.rejects(applyExpensePlan(db,{...plan,examined:999},plan.sha256),/Plano alterado/)
  await applyExpensePlan(db,plan,plan.sha256)
  assert.equal((await expensePlan(db,task.owner,2025)).changes.length,0)
  const event=await db.query("select previous->>'id' as old_id from data_revisions where kind='expense' and id=$1 order by revision desc limit 1",[canonical])
  assert.equal(event.rows[0].old_id,old)
  assert.equal((await db.query('select amount::text from records where id=$1',[canonical])).rows[0].amount,'-10.00')
  const api=await app({query:db.query.bind(db)} as unknown as pg.Pool)
  try {assert.equal((await api.inject('/api/records/expense/'+old)).json().id,canonical)}finally{await api.close()}
  await db.query('rollback')
  await assert.rejects(persist(db,jobKey(task),task,{...page,records:[{...page.records[0],id:old}]}),/Conciliação/)
 } finally {
  await db.query('rollback')
  await db.query("delete from records where kind='expense' and owner=$1",[task.owner])
  await db.query('delete from collection_jobs where key=$1',[jobKey(task)])
  db.release();await pool.end()
 }
})
