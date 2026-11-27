import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomInt} from 'node:crypto'
import pg from 'pg'
import {generalBatch,retryDelay,validateBatch,type BatchConfig} from '../packages/scout/general-batch.ts'
import {enqueue,jobKey} from '../packages/scout/store.ts'
import {collectionUrl,configureCollectionBudget,readCollectionPage,CollectionBudgetExceeded,type Task} from '../packages/collectors/camara/index.ts'
import {app} from '../apps/api/app.ts'

const defaults:BatchConfig={kinds:['proposal'],year:2010,maxTasks:1,maxSeconds:5,maxRequests:3,maxBytes:100000,databaseLimitBytes:500000000,maxPending:10000}
const requestName=(owner:string)=>'Consulta teste '+[...owner].map(n=>String.fromCharCode(97+Number(n))).join('')
test('orçamentos, jitter e limite de requisições falham antes da rede',async()=>{
 assert.throws(()=>validateBatch({...defaults,maxTasks:100000}))
 assert.throws(()=>validateBatch({...defaults,owner:'https://127.0.0.1'}))
 assert.doesNotThrow(()=>validateBatch({...defaults,kinds:['ballot'],owner:'2520670-66'}))
 assert.equal(retryDelay(1,()=>0),45000)
 assert.ok(retryDelay(100,()=>1)<=86400000)
 configureCollectionBudget({deadline:Date.now()+1000,maxRequests:0,maxBytes:1000})
 try{await assert.rejects(readCollectionPage({kind:'politician',year:2010}),CollectionBudgetExceeded)}finally{configureCollectionBudget()}
})
async function fixture(run:(db:pg.PoolClient,owner:string,keys:string[])=>Promise<void>){
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path=observabr,public,extensions'})
 const db=await pool.connect(),owner=String(randomInt(70000000,79999999)),keys:string[]=[]
 try{await db.query('select pg_advisory_lock(6211501)');await run(db,owner,keys)}finally{
  await db.query('delete from collection_requests where job_key=any($1::text[]) or name=$2',[keys,requestName(owner)])
  await db.query('update collection_jobs set cycle_id=null where key=any($1::text[])',[keys])
  for(const table of ['collection_observations','collection_absences','collection_receipts'])await db.query(`delete from ${table} where cycle_id in(select id from collection_cycles where job_key=any($1::text[]))`,[keys])
  await db.query('delete from collection_quarantine where job_key=any($1::text[])',[keys])
  await db.query('delete from collection_cycles where job_key=any($1::text[])',[keys])
  await db.query('delete from collection_jobs where key=any($1::text[])',[keys])
  await db.query("delete from records where owner=$1",[owner])
  await db.query('select pg_advisory_unlock(6211501)');db.release();await pool.end()
 }
}
async function seed(db:pg.PoolClient,task:Task,keys:string[],priority=10){await enqueue(db,task,priority);keys.push(jobKey(task))}
const empty=async(task:Task,page:number)=>({url:collectionUrl(task,page).href,page,raw:Buffer.from('{"dados":[],"links":[]}')})

test('pedido HTTP aguarda retry, reabre na tentativa seguinte e conclui junto da tarefa',{skip:!process.env.TEST_DATABASE_URL},async()=>fixture(async(db,owner,keys)=>{
 const api=await app({query:db.query.bind(db)} as unknown as pg.Pool)
 const config={...defaults,kinds:['politician' as const]},name=requestName(owner)
 const key=jobKey({kind:'politician',name,year:config.year});keys.push(key)
 const status=async(id:string)=>{const r=await api.inject('/api/requests/'+id);assert.equal(r.statusCode,200);return r.json().status}
 try{
  const request=await api.inject({method:'POST',url:'/api/requests',payload:{name}})
  assert.equal(request.statusCode,202)
  const first=request.json().id
  await generalBatch(db,config,async()=>{throw Object.assign(new Error('503'),{retryAfter:3600000})})
  assert.equal(await status(first),'running')
  const job=(await db.query('select status,due_at>now() waiting from collection_jobs where key=$1',[key])).rows[0]
  assert.equal(job.status,'failed');assert.equal(job.waiting,true)
  const second=(await api.inject({method:'POST',url:'/api/requests',payload:{name}})).json().id
  const waiting=await generalBatch(db,config,async()=>{throw Error('Retry antecipado')})
  assert.equal(waiting.tasks,0);assert.equal(await status(second),'running')
  await db.query("update collection_requests set status='failed' where id=$1",[first])
  await db.query('update collection_jobs set due_at=now() where key=$1',[key])
  await generalBatch(db,config,async(t,p)=>{
   assert.equal(await status(first),'running');assert.equal(await status(second),'running')
   return empty(t,p)
  })
  assert.equal(await status(first),'done');assert.equal(await status(second),'done')
 }finally{await api.close()}
}))

test('ausência em ciclo completo preserva registro e evidência anterior',{skip:!process.env.TEST_DATABASE_URL},async()=>fixture(async(db,owner,keys)=>{
 const task:Task={kind:'proposal',owner,year:2010};await seed(db,task,keys)
 const first=async(t:Task,p:number)=>({...await empty(t,p),raw:Buffer.from(JSON.stringify({dados:[{id:owner,siglaTipo:'PL',numero:1,ano:2010}],links:[]}))})
 await generalBatch(db,{...defaults,owner},first)
 await db.query('update collection_jobs set due_at=now() where key=$1',[keys[0]])
 await generalBatch(db,{...defaults,owner},empty)
 assert.equal((await db.query('select count(*)::int n from collection_absences where cycle_id in(select id from collection_cycles where job_key=$1)',[keys[0]])).rows[0].n,1)
 assert.equal((await db.query("select count(*)::int n from records where kind='proposal' and owner=$1",[owner])).rows[0].n,1)
}))
test('backlog nominal não bloqueia despesas/proposições e respeita limite de tarefas',{skip:!process.env.TEST_DATABASE_URL},async()=>fixture(async(db,owner,keys)=>{
 for(let i=0;i<30;i++)await seed(db,{kind:'ballot',owner:owner+'-'+i,year:2010},keys,0)
 await seed(db,{kind:'expense',owner,year:2010},keys,20)
 await seed(db,{kind:'proposal',owner,year:2010},keys,20)
 await db.query("update collection_kind_state set last_served_at='epoch'")
 const served:string[]=[]
 const result=await generalBatch(db,{...defaults,kinds:['ballot','expense','proposal'],maxTasks:3},async(t,p)=>{served.push(t.kind);return empty(t,p)})
 assert.deepEqual(new Set(served),new Set(['ballot','expense','proposal']))
 assert.equal(result.tasks,3)
 assert.equal(result.status,'task_limit')
}))
test('checkpoint parcial recupera interrupção e só conclui ciclo com páginas contíguas',{skip:!process.env.TEST_DATABASE_URL},async()=>fixture(async(db,owner,keys)=>{
 const task:Task={kind:'proposal',owner,year:2010};await seed(db,task,keys)
 const fetcher=async(t:Task,p:number)=>({url:collectionUrl(t,p).href,page:p,raw:Buffer.from(JSON.stringify({dados:p===1?[{id:owner,siglaTipo:'PL',numero:1,ano:2010}]:[],links:p===1?[{rel:'next'}]:[]}))})
 await generalBatch(db,{...defaults,owner},fetcher)
 assert.equal((await db.query('select page from collection_jobs where key=$1',[keys[0]])).rows[0].page,2)
 await db.query("update collection_jobs set status='running' where key=$1",[keys[0]])
 await generalBatch(db,{...defaults,owner},fetcher)
 assert.equal((await db.query('select status from collection_jobs where key=$1',[keys[0]])).rows[0].status,'done')
 const cycle=(await db.query('select status,pages,source_rows from collection_cycles where job_key=$1',[keys[0]])).rows[0]
 assert.equal(cycle.status,'complete');assert.equal(cycle.pages,2);assert.equal(cycle.source_rows,'1')
}))
test('erro de validação preserva bytes em quarentena e falha transitória chega à dead-letter',{skip:!process.env.TEST_DATABASE_URL},async()=>fixture(async(db,owner,keys)=>{
 const task:Task={kind:'proposal',owner,year:2010};await seed(db,task,keys)
 const request=(await db.query("insert into collection_requests(name,job_key,status) values($1,$2,'running') returning id",[requestName(owner),keys[0]])).rows[0].id
 const requestStatus=async()=>(await db.query('select status from collection_requests where id=$1',[request])).rows[0].status
 await generalBatch(db,{...defaults,owner},async(t,p)=>({...await empty(t,p),raw:Buffer.from('{')}))
 assert.equal((await db.query('select status from collection_jobs where key=$1',[keys[0]])).rows[0].status,'quarantined')
 assert.equal(await requestStatus(),'failed')
 assert.equal((await db.query('select count(*)::int as n from collection_quarantine where job_key=$1',[keys[0]])).rows[0].n,1)
 await db.query("update collection_jobs set status='queued',attempts=0,max_attempts=2,due_at=now() where key=$1",[keys[0]])
 const failed=async()=>{throw Object.assign(new Error('503'),{retryAfter:3600000})}
 await generalBatch(db,{...defaults,owner},failed)
 assert.equal(await requestStatus(),'running')
 const retry=(await db.query('select due_at>now()+interval \'59 minutes\' as respected from collection_jobs where key=$1',[keys[0]])).rows[0]
 assert.equal(retry.respected,true)
 await db.query('update collection_jobs set due_at=now() where key=$1',[keys[0]])
 await generalBatch(db,{...defaults,owner},failed)
 assert.equal((await db.query('select status from collection_jobs where key=$1',[keys[0]])).rows[0].status,'dead')
 assert.equal(await requestStatus(),'failed')
}))
