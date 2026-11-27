import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomInt} from 'node:crypto'
import pg from 'pg'
import {generalBatch,type BatchConfig} from '../packages/scout/general-batch.ts'
import {enqueue,jobKey,persist} from '../packages/scout/store.ts'
import {collectionUrl,parsePage,type Task} from '../packages/collectors/camara/index.ts'

async function connect(){
 const db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path=observabr,public,extensions'})
 await db.connect();return db as unknown as pg.PoolClient
}
async function fixture(run:(s:{db:pg.PoolClient;owner:string;keys:string[];restart:()=>Promise<void>})=>Promise<void>){
 const s={db:await connect(),owner:String(randomInt(80000000,89999999)),keys:[] as string[],restart:async()=>{
  const pid=(await s.db.query('select pg_backend_pid() pid')).rows[0].pid
  await (s.db as unknown as pg.Client).end();s.db=await connect()
  assert.notEqual((await s.db.query('select pg_backend_pid() pid')).rows[0].pid,pid)
 }}
 try{await run(s)}finally{
  await s.db.query('delete from collection_requests where job_key=any($1::text[])',[s.keys])
  await s.db.query('update collection_jobs set cycle_id=null where key=any($1::text[])',[s.keys])
  for(const table of ['collection_observations','collection_absences','collection_receipts'])await s.db.query(`delete from ${table} where cycle_id in(select id from collection_cycles where job_key=any($1::text[]))`,[s.keys])
  await s.db.query('delete from collection_quarantine where job_key=any($1::text[])',[s.keys])
  await s.db.query('delete from collection_cycles where job_key=any($1::text[])',[s.keys])
  await s.db.query('delete from collection_jobs where key=any($1::text[])',[s.keys])
  await (s.db as unknown as pg.Client).end()
 }
}
const config=(owner:string,years=[2026,2010]):BatchConfig=>({kinds:['proposal'],year:years[0],years,owner,maxTasks:1,maxSeconds:10,maxRequests:20,maxBytes:100000,databaseLimitBytes:500000000,maxPending:10000})
const source=(task:Task,page:number,next=false)=>({page,url:collectionUrl(task,page).href,raw:Buffer.from(JSON.stringify({dados:[],links:next?[{rel:'next'}]:[]}))})
async function seed(s:{db:pg.PoolClient,keys:string[]},task:Task){await enqueue(s.db,task);s.keys.push(jobKey(task));return jobKey(task)}
const enabled={skip:!process.env.TEST_DATABASE_URL}

test('refresh histórico mantém a quinta oportunidade entre páginas, restart, backoff e encerramento',enabled,async()=>fixture(async s=>{
 const historical:Task={kind:'proposal',year:2010,owner:s.owner},recent:Task={kind:'proposal',year:2026,owner:s.owner}
 const key=await seed(s,historical)
 await generalBatch(s.db,config(s.owner,[2010]),async(t,p)=>source(t,p))
 assert.equal((await s.db.query('select mode from collection_cycles where job_key=$1',[key])).rows[0].mode,'backfill')
 await seed(s,recent)
 await s.db.query('update collection_jobs set due_at=now() where key=$1',[key])
 await s.db.query("update collection_kind_state set served=4 where kind='proposal'")
 const request=(await s.db.query("insert into collection_requests(name,status,job_key) values($1,'running',$2) returning id",['Pedido de teste '+s.owner,key])).rows[0].id
 const seen:Array<{year:number,page:number,mode:string}>=[]
 let failSecondPage=true
 const fetcher=async(t:Task,p:number)=>{
  const cycle=(await s.db.query('select c.id,c.mode from collection_jobs j join collection_cycles c on c.id=j.cycle_id where j.key=$1',[jobKey(t)])).rows[0]
  seen.push({year:t.year,page:p,mode:cycle.mode})
  if(t.year===2010&&p===2&&failSecondPage){failSecondPage=false;throw Object.assign(new Error('503'),{retryAfter:3600000})}
  return source(t,p,t.year===2026||p<3)
 }
 await generalBatch(s.db,config(s.owner),fetcher)
 const active=(await s.db.query('select cycle_id,page from collection_jobs where key=$1',[key])).rows[0]
 assert.equal(active.page,2)
 await s.db.query("update collection_jobs set status='running' where key=$1",[key])
 await s.restart()
 await generalBatch(s.db,{...config(s.owner),maxTasks:4},fetcher)
 await generalBatch(s.db,config(s.owner),fetcher)
 let job=(await s.db.query('select cycle_id,status,page,due_at>now() waiting from collection_jobs where key=$1',[key])).rows[0]
 assert.equal(job.status,'failed');assert.equal(job.waiting,true);assert.equal(job.page,2);assert.equal(job.cycle_id,active.cycle_id)
 assert.equal((await s.db.query('select status from collection_requests where id=$1',[request])).rows[0].status,'running')
 await generalBatch(s.db,{...config(s.owner),maxTasks:4},fetcher)
 await s.db.query('update collection_jobs set due_at=now() where key=$1',[key])
 await generalBatch(s.db,config(s.owner),fetcher)
 assert.equal((await s.db.query('select page from collection_jobs where key=$1',[key])).rows[0].page,3)
 assert.equal((await generalBatch(s.db,config(s.owner),fetcher,()=>true)).status,'interrupted')
 await s.restart()
 await generalBatch(s.db,{...config(s.owner),maxTasks:5},fetcher)
 assert.deepEqual(seen.filter(v=>v.year===2010).map(v=>[v.page,v.mode]),[[1,'refresh'],[2,'refresh'],[2,'refresh'],[3,'refresh']])
 assert.deepEqual(seen.flatMap((v,i)=>v.year===2010?[i]:[]),[0,5,10,15])
 assert.ok(seen.filter(v=>v.year===2026).every(v=>v.mode==='backfill'))
 job=(await s.db.query("select cycle_id,status,page,due_at>now()+interval '29 days' cadence from collection_jobs where key=$1",[key])).rows[0]
 assert.equal(job.cycle_id,null);assert.equal(job.status,'done');assert.equal(job.page,1);assert.equal(job.cadence,true)
 const closed=(await s.db.query('select mode,status,pages from collection_cycles where id=$1',[active.cycle_id])).rows[0]
 assert.deepEqual(closed,{mode:'refresh',status:'complete',pages:3})
 assert.equal((await s.db.query('select status from collection_requests where id=$1',[request])).rows[0].status,'done')
 await assert.rejects(s.db.query("update collection_cycles set mode='backfill' where id=$1",[active.cycle_id]),/imutáveis/)
 const last=source(historical,3)
 await persist(s.db,key,historical,parsePage(last.raw,historical,3,last.url),undefined,active.cycle_id,30)
 assert.equal((await s.db.query('select pages from collection_cycles where id=$1',[active.cycle_id])).rows[0].pages,3)
 await s.db.query('update collection_jobs set due_at=now() where key=$1',[key])
 await s.db.query("update collection_kind_state set served=4 where kind='proposal'")
 await generalBatch(s.db,config(s.owner),async(t,p)=>source(t,p))
 const cycles=(await s.db.query('select mode from collection_cycles where job_key=$1 order by started_at',[key])).rows.map(r=>r.mode)
 assert.deepEqual(cycles,['backfill','refresh','refresh'])
}))

test('refreshes antigos e recentes avançam sem starvation sob backfill recente ilimitado',enabled,async()=>fixture(async s=>{
 const years=[2026,2025,2010]
 for(const year of years){const key=await seed(s,{kind:'proposal',year,owner:s.owner});if(year!==2026)await s.db.query("update collection_jobs set status='done',updated_at=now()-$2::int*interval '1 day' where key=$1",[key,year===2010?3:2])}
 await s.db.query("update collection_kind_state set served=4 where kind='proposal'")
 const seen:number[]=[]
 await generalBatch(s.db,{...config(s.owner,years),maxTasks:16},async(t,p)=>{seen.push(t.year);return source(t,p,t.year===2026||p<2)})
 assert.deepEqual(seen.filter(y=>y!==2026),[2010,2025,2010,2025])
 assert.equal(seen.filter(y=>y===2026).length,12)
 assert.equal((await s.db.query("select count(*)::int n from collection_cycles c join collection_jobs j on j.key=c.job_key where j.key=any($1) and c.mode='refresh' and c.status='complete'",[s.keys])).rows[0].n,2)
}))

test('persistência complementar e consumidor concorrente não apagam ciclo ativo',enabled,async()=>fixture(async s=>{
 const task:Task={kind:'proposal',year:2010,owner:s.owner},key=await seed(s,task),c=config(s.owner,[2010])
 await generalBatch(s.db,c,async(t,p)=>source(t,p))
 await s.db.query('update collection_jobs set due_at=now() where key=$1',[key])
 await generalBatch(s.db,c,async()=>{throw new Error('503')})
 const job=(await s.db.query('select status,page,cycle_id from collection_jobs where key=$1',[key])).rows[0]
 const single=source(task,1)
 await persist(s.db,key,task,parsePage(single.raw,task,1,single.url))
 assert.deepEqual((await s.db.query('select status,page,cycle_id from collection_jobs where key=$1',[key])).rows[0],job)
 const foreignKey=await seed(s,{kind:'proposal',year:2025,owner:s.owner})
 const foreign=(await s.db.query("insert into collection_cycles(job_key,mode) values($1,'backfill') returning id",[foreignKey])).rows[0].id
 await assert.rejects(persist(s.db,key,task,parsePage(single.raw,task,1,single.url),undefined,foreign),/ciclo ativo/)
 await s.db.query('select pg_advisory_lock(6211501)')
 const other=await connect()
 try{await assert.rejects(generalBatch(other,c),/Outro Scout/)}finally{await (other as unknown as pg.Client).end();await s.db.query('select pg_advisory_unlock(6211501)')}
 assert.equal((await s.db.query('select mode from collection_cycles where id=$1',[job.cycle_id])).rows[0].mode,'refresh')
 await s.db.query('update collection_jobs set due_at=now() where key=$1',[key])
 await generalBatch(s.db,c,async(t,p)=>source(t,p))
 assert.equal((await s.db.query('select status from collection_cycles where id=$1',[job.cycle_id])).rows[0].status,'complete')
}))

test('falha no claim não consome oportunidade nem deixa ciclo ou estado parcial',enabled,async()=>fixture(async s=>{
 const task:Task={kind:'proposal',year:2010,owner:s.owner},key=await seed(s,task),c=config(s.owner,[2010])
 await s.db.query("update collection_jobs set status='done' where key=$1",[key])
 await s.db.query("update collection_kind_state set served=4,last_served_at='epoch' where kind='proposal'")
 const before=(await s.db.query("select served,last_served_at from collection_kind_state where kind='proposal'")).rows[0]
 const failing={query:async(sql:string,args?:unknown[])=>{
  if(sql.startsWith("update collection_jobs set status='running'"))throw Error('Falha injetada no claim')
  return s.db.query(sql,args)
 }} as unknown as pg.PoolClient
 await assert.rejects(generalBatch(failing,c),/Falha injetada/)
 assert.deepEqual((await s.db.query("select served,last_served_at from collection_kind_state where kind='proposal'")).rows[0],before)
 assert.deepEqual((await s.db.query('select status,cycle_id from collection_jobs where key=$1',[key])).rows[0],{status:'done',cycle_id:null})
 assert.equal((await s.db.query('select count(*)::int n from collection_cycles where job_key=$1',[key])).rows[0].n,0)
 await generalBatch(s.db,c,async(t,p)=>source(t,p))
 assert.equal((await s.db.query('select mode from collection_cycles where job_key=$1',[key])).rows[0].mode,'refresh')
}))

test('checkpoint inconsistente é isolado sem bloquear outros trabalhos',enabled,async()=>fixture(async s=>{
 const bad:Task={kind:'proposal',year:2010,owner:s.owner},good:Task={kind:'proposal',year:2026,owner:s.owner}
 const badKey=await seed(s,bad),goodKey=await seed(s,good)
 const foreign=(await s.db.query("insert into collection_cycles(job_key,mode) values($1,'backfill') returning id",[goodKey])).rows[0].id
 await s.db.query('update collection_jobs set cycle_id=$2 where key=$1',[badKey,foreign])
 await s.db.query("update collection_kind_state set served=0 where kind='proposal'")
 const fetched:string[]=[]
 const result=await generalBatch(s.db,{...config(s.owner,[2010,2026]),maxTasks:2},async(t,p)=>{fetched.push(jobKey(t));return source(t,p)})
 assert.deepEqual(fetched,[goodKey]);assert.equal(result.failures,1);assert.equal(result.pages,1)
 assert.equal((await s.db.query('select status from collection_jobs where key=$1',[badKey])).rows[0].status,'quarantined')
}))
