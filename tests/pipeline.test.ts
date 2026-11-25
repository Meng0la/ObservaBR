import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import {randomUUID} from 'node:crypto'
import {createHash} from 'node:crypto'
import {parsePage} from '../packages/collectors/camara/index.ts'
import {persist,enqueue,jobKey} from '../packages/scout/store.ts'
import {app} from '../apps/api/app.ts'

// TEST_DATABASE_URL must identify a dedicated, disposable database, with the migration installed.
test('PostgreSQL preserva evidência, estorno, idempotência, revisão e paginação', {skip:!process.env.TEST_DATABASE_URL},async()=>{
  const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path=observabr,public,extensions'})
  const db=await pool.connect()
  const task={kind:'expense' as const,owner:randomUUID(),year:2025}
  const url='https://dadosabertos.camara.leg.br/api/v2/deputados/123/despesas'
  const api=await app(pool)
  async function save(value:number) {
    const raw=Buffer.from(JSON.stringify({dados:[{ano:2025,mes:3,codDocumento:500,codLote:1,tipoDespesa:'Teste isolado',valorLiquido:value,dataDocumento:'2025-03-01'}],links:[]}))
    const page=parsePage(raw,task,1,url)
    await persist(db,jobKey(task),task,page)
    return page.records[0].id
  }
  try {
    await enqueue(db,task)
    const id=await save(-12.5)
    await save(-12.5)
    await save(-13)
    const r=await api.inject('/api/records?owner='+task.owner)
    assert.equal(r.statusCode,200)
    assert.equal(r.json().total,1)
    assert.equal(r.json().items[0].amount,'-13.00')
    assert.equal(r.json().items[0].sha256.length,64)
    assert.equal((await api.inject('/api/history/'+task.owner)).json()[0].amount,'-13.00')
    assert.equal((await db.query('select count(*)::int as n from data_revisions where id=$1',[id])).rows[0].n,1)
    assert.equal((await api.inject('/api/records?format=csv&owner='+task.owner)).statusCode,200)
  } finally {await api.close();db.release();await pool.end()}
})

test('diretório filtra vínculos, ordena nulos por último e mede datas observadas', {skip:!process.env.TEST_DATABASE_URL},async()=>{
  const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path=observabr,public,extensions'})
  const db=await pool.connect()
  const api=await app({query:db.query.bind(db)} as unknown as pg.Pool)
  const party='TEST-'+randomUUID(), deputy=randomUUID(), second=randomUUID(), other=randomUUID()
  const source='https://dadosabertos.camara.leg.br/api/v2/deputados'
  // Synthetic records are rolled back and are visible only to this connection.
  const raw=Buffer.from(JSON.stringify({fixture:party}))
  const sha=createHash('sha256').update(raw).digest('hex')
  async function record(kind:string,id:string,owner:string|null,title:string,date:string|null,amount:string|null,data:Record<string,string>) {
    await db.query(`insert into records(kind,id,owner,title,date,amount,data,source_url,api_url,field,sha256,search_text)
      values($1,$2,$3,$4,$5,$6,$7,$8,$8,'/fixture',$9,lower(unaccent($4)))`,[kind,id,owner,title,date,amount,data,source,sha])
  }
  async function results(query:string) {
    const response=await api.inject('/api/records?party='+encodeURIComponent(party)+'&'+query)
    assert.equal(response.statusCode,200)
    assert.equal(response.json().pageSize,25)
    return response.json().items.map((r:{title:string})=>r.title)
  }
  try {
    await db.query('begin')
    await db.query('insert into source_documents(sha256,raw) values($1,$2)',[sha,raw])
    await record('politician',deputy,null,'Álvaro',null,null,{party,uf:'AP'})
    await record('politician',second,null,'Beatriz',null,null,{party,uf:'RJ'})
    await record('politician',other,null,'Carlos',null,null,{party:'OUTRO-'+party,uf:'AP'})
    for(const [title,date,amount] of [['A','2025-02-02','10'],['B','2025-01-01','20'],['C',null,null]] as const) {
      await record('expense',randomUUID(),deputy,title,date,amount,{})
    }
    await record('expense',randomUUID(),other,'Outro',null,null,{})
    assert.deepEqual(await results('kind=politician&sort=name-desc'),['Beatriz','Álvaro'])
    assert.deepEqual(await results('kind=politician&sort=name-asc&uf=AP'),['Álvaro'])
    assert.deepEqual(await results('kind=expense&sort=date-asc'),['B','A','C'])
    assert.deepEqual(await results('kind=expense&sort=date-desc'),['A','B','C'])
    assert.deepEqual(await results('kind=expense&sort=amount-desc'),['B','A','C'])
    assert.deepEqual(await results('kind=expense&sort=amount-asc'),['A','B','C'])
    const before=(await api.inject('/api/summary')).json()
    const proposalId=randomUUID()
    await record('proposal',randomUUID(),deputy,'REQ',null,null,{proposalId})
    await record('proposal',randomUUID(),second,'REQ',null,null,{proposalId})
    const summary=(await api.inject('/api/summary')).json()
    assert.ok(summary.parties.includes(party))
    assert.equal(summary.counts.proposal,before.counts.proposal+1)
    assert.equal(summary.counts.proposalLinks,before.counts.proposalLinks+2)
    const bounds=await db.query("select to_char(min(date),'YYYY-MM-DD') as lo,to_char(max(date),'YYYY-MM-DD') as hi from records where kind='expense'")
    assert.deepEqual(summary.periods.find((p:{kind:string})=>p.kind==='expense'),{kind:'expense',from:bounds.rows[0].lo,to:bounds.rows[0].hi})
  } finally {await db.query('rollback');await api.close();db.release();await pool.end()}
})
