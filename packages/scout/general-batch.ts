import {createHash} from 'node:crypto'
import type pg from 'pg'
import {transaction} from '../database/index.ts'
import {collectionUrl,readCollectionPage,parsePage,configureCollectionBudget,collectionUsage,CollectionBudgetExceeded,type Task} from '../collectors/camara/index.ts'
import {persist,enqueue,jobKey} from './store.ts'
import {expensePlan} from './expense-reconciliation.ts'

export type BatchConfig={kinds:Task['kind'][];year:number;month?:number;owner?:string;maxTasks:number;maxSeconds:number;maxRequests:number;maxBytes:number;databaseLimitBytes:number;maxPending:number}
type Fetcher=(task:Task,page:number)=>ReturnType<typeof readCollectionPage>
export function retryDelay(attempt:number,random= Math.random){return Math.min(24*3600_000,30_000*2**Math.min(attempt,12)*(.75+random()*.5))}
export function validateBatch(c:BatchConfig){
 const kinds=['politician','expense','proposal','vote','ballot']
 if(!c.kinds.length||c.kinds.some(k=>!kinds.includes(k))||new Set(c.kinds).size!==c.kinds.length)throw Error('Tipos de coleta inválidos')
 if(!Number.isInteger(c.year)||c.year<2008||c.year>new Date().getUTCFullYear())throw Error('Ano inválido')
 if(c.month!=null&&(!Number.isInteger(c.month)||c.month<1||c.month>12))throw Error('Mês inválido')
 if(c.owner!=null&&!(c.kinds.length===1&&c.kinds[0]==='ballot'?/^\d{1,14}-\d{1,10}$/:/^[1-9]\d{0,13}$/).test(c.owner))throw Error('Identificador inválido')
 for(const [value,min,max] of [[c.maxTasks,1,100],[c.maxSeconds,1,600],[c.maxRequests,1,300],[c.maxBytes,1024,64*1024*1024],[c.databaseLimitBytes,1024*1024,1e12],[c.maxPending,1,100000]])
  if(!Number.isSafeInteger(value)||value<min||value>max)throw Error('Orçamento inválido')
}
export async function generalBatch(db:pg.PoolClient,c:BatchConfig,fetcher:Fetcher=readCollectionPage,shouldStop=()=>false){
 validateBatch(c)
 const deadline=Date.now()+c.maxSeconds*1000
 const summary={runId:'',tasks:0,pages:0,records:0,failures:0,bytes:0,requests:0,status:'complete'}
 const lock=await db.query('select pg_try_advisory_lock(6211501) as acquired')
 if(!lock.rows[0].acquired)throw Error('Outro Scout está consumindo a fila')
 configureCollectionBudget({deadline,maxRequests:c.maxRequests,maxBytes:c.maxBytes})
 try {
  // Acquiring the common session lock proves that no other supported consumer is alive.
  await db.query("update collection_jobs set status='queued',error='Execução interrompida; checkpoint preservado' where status='running'")
  await db.query("update collection_runs set status='interrupted',finished_at=now() where status='running'")
  summary.runId=(await db.query('insert into collection_runs(config) values($1) returning id',[c])).rows[0].id
  if(c.kinds.includes('politician')&&!c.owner)await transaction(db,async()=>{
   const capacity=(await db.query("select count(*)::int n from collection_jobs where status in ('queued','failed','running')")).rows[0].n
   const available=Math.max(0,Math.min(5,c.maxTasks,c.maxPending-capacity))
   const requests=await db.query("select id,name from collection_requests where status='queued' order by requested_at limit $1 for update",[available])
   for(const request of requests.rows){
    const task:Task={kind:'politician',name:request.name,year:c.year};collectionUrl(task)
    await enqueue(db,task,0)
    await db.query("update collection_requests r set status=case when j.status='queued' then 'running' else j.status end,job_key=j.key from collection_jobs j where r.id=$1 and j.key=$2",[request.id,jobKey(task)])
   }
  })
  while(summary.tasks<c.maxTasks&&Date.now()<deadline&&!shouldStop()){
   const usage=collectionUsage()
   if(usage.requests>=c.maxRequests||usage.bytes>=c.maxBytes){summary.status='budget';break}
   const limits=await db.query("select pg_database_size(current_database())::float8 as bytes,(select count(*)::int from collection_jobs where status in ('queued','failed','running')) as pending")
   if(limits.rows[0].bytes+c.maxBytes>c.databaseLimitBytes*.95){summary.status='capacity';break}
   const next=await db.query(`select j.* from collection_jobs j join collection_kind_state k on k.kind=j.kind
    where j.kind=any($1::text[]) and j.task->>'year'=$2 and j.due_at<=now()
    and j.status in ('queued','failed','done') and ($3::text is null or j.kind<>'vote' or j.task->>'month'=$3)
    and ($4::text is null or j.task->>'owner'=$4)
    and ($5::boolean or j.kind not in ('politician','vote'))
    order by k.last_served_at,j.priority,j.due_at,j.key limit 1`,[c.kinds,String(c.year),c.month==null?null:String(c.month),c.owner??null,limits.rows[0].pending+200<=c.maxPending])
   if(!next.rowCount)break
   const job=next.rows[0]
   await db.query('update collection_kind_state set last_served_at=clock_timestamp() where kind=$1',[job.kind])
   // Validation occurs before marking a task running or accepting any URL from persisted JSON.
   try{collectionUrl(job.task,job.page)}catch{await db.query("update collection_jobs set status='dead',error='Tarefa institucional inválida' where key=$1",[job.key]);summary.failures++;summary.tasks++;continue}
   await transaction(db,async()=>{
    if(!job.cycle_id)job.cycle_id=(await db.query('insert into collection_cycles(job_key) values($1) returning id',[job.key])).rows[0].id
    await db.query("update collection_jobs set status='running',started_at=now(),updated_at=now(),cycle_id=$2 where key=$1",[job.key,job.cycle_id])
    await db.query('update collection_kind_state set last_served_at=clock_timestamp() where kind=$1',[job.kind])
   })
   summary.tasks++
   let source:Awaited<ReturnType<Fetcher>>|undefined
   let validation=false
   let identity=false
   try {
    if(job.kind==='expense'){
     identity=true
     if((await expensePlan(db,job.task.owner,job.task.year)).changes.length)throw Error('Conciliação de identidade pendente')
     identity=false
    }
    source=await fetcher(job.task,job.page)
    validation=true
    const page=parsePage(source.raw,job.task,job.page,source.url)
    await persist(db,job.key,job.task,page,undefined,job.cycle_id)
    summary.pages++;summary.records+=page.records.length
   }catch(error){
    if(error instanceof CollectionBudgetExceeded||Date.now()>=deadline){
     await db.query("update collection_jobs set status='queued' where key=$1",[job.key]);summary.status='budget';break
    }
    summary.failures++
    const quarantine=validation||identity
    const attempts=job.attempts+1
    const status=quarantine?'quarantined':attempts>=job.max_attempts?'dead':'failed'
    await transaction(db,async()=>{
     if(source){
      const hash=createHash('sha256').update(source.raw).digest('hex')
      await db.query('insert into source_documents(sha256,raw) values($1,$2) on conflict do nothing',[hash,source.raw])
      await db.query('insert into collection_quarantine(job_key,page,sha256,error) values($1,$2,$3,$4) on conflict do nothing',[job.key,job.page,hash,'Página preservada; validação/publicação interrompida'])
     }
     const retryAfter=error&&typeof error==='object'&&'retryAfter' in error?Number(error.retryAfter):0
     const delay=Math.max(retryDelay(attempts),Number.isFinite(retryAfter)?Math.max(0,retryAfter):0)
     await db.query("update collection_jobs set status=$2,attempts=$3,error=$4,updated_at=now(),due_at=now()+$5::float8*interval '1 millisecond' where key=$1",
      [job.key,status,attempts,identity?'Conciliação de identidade pendente':quarantine?'Página em quarentena':'Falha na fonte; retry com backoff',delay])
    })
   }
  }
  if(shouldStop())summary.status='interrupted'
  else if(Date.now()>=deadline)summary.status='budget'
  else if(summary.tasks===c.maxTasks&&summary.status==='complete')summary.status='task_limit'
  Object.assign(summary,collectionUsage())
  await db.query('update collection_runs set finished_at=now(),tasks=$2,pages=$3,records=$4,failures=$5,bytes=$6,requests=$7,status=$8 where id=$1',
   [summary.runId,summary.tasks,summary.pages,summary.records,summary.failures,summary.bytes,summary.requests,summary.status])
  return summary
 }catch(error){
  if(summary.runId)await db.query("update collection_runs set finished_at=now(),status='failed' where id=$1",[summary.runId]).catch(()=>{})
  throw error
 }finally {configureCollectionBudget();await db.query('select pg_advisory_unlock(6211501)')}
}
