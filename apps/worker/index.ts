import {setTimeout as sleep} from 'node:timers/promises'
import {database} from '../../packages/database/index.ts'
import {enqueue} from '../../packages/scout/store.ts'
import {generalBatch,validateBatch,type BatchConfig} from '../../packages/scout/general-batch.ts'
import {runNextEnrichment} from '../../packages/scout/enrichment.ts'

const batch=process.argv.includes('--enrichment-batch')
const maxJobs=Number(process.env.SCOUT_MAX_JOBS||3)
const maxSeconds=Number(process.env.SCOUT_MAX_SECONDS||180)
if(!Number.isInteger(maxJobs)||maxJobs<1||maxJobs>10||!Number.isInteger(maxSeconds)||maxSeconds<1||maxSeconds>600) {
  throw new Error('Limites inválidos para o lote do Scout')
}
const deadline=Date.now()+maxSeconds*1000
const databaseTarget=new URL(process.env.DATABASE_URL||'')
if(databaseTarget.hostname.endsWith('.pooler.supabase.com')&&databaseTarget.port!=='5432')throw Error('Scout exige Session pooler na porta 5432')
let processed=0
const pool=database()
const db=await pool.connect()
let stop=false
process.on('SIGTERM',()=>{stop=true})
process.on('SIGINT',()=>{stop=true})
try {
  const lock=await db.query('select pg_try_advisory_lock(6211501) as acquired')
  if(!lock.rows[0].acquired) throw new Error('Outro Scout está consumindo a fila')
  if(!batch)await db.query("update collection_jobs set status='queued' where status='running'")
  do {
    if(batch&&Date.now()>=deadline)break
    try {
      if(await runNextEnrichment(db)) {
        processed++
        if(process.argv.includes('--once')||process.argv.includes('--enrichment-once')||(batch&&processed>=maxJobs))break
        continue
      }
    } catch(error) {
      console.error(error instanceof Error?error.message:'Falha no enriquecimento')
      if(batch)throw new Error('Lote complementar interrompido; nova tentativa persistida na fila')
    }
    if(batch||process.argv.includes('--enrichment-once'))break
    if(process.argv.includes('--enrichment-only')){
      await sleep(3000)
      continue
    }
    const now=new Date()
    const year=Number(process.env.COLLECTION_YEAR||now.getUTCFullYear())
    if(!Number.isInteger(year)||year<2008||year>now.getUTCFullYear()) throw new Error('COLLECTION_YEAR inválido')
    const config:BatchConfig={kinds:['politician','expense','proposal','vote','ballot'],year,
      maxTasks:maxJobs,maxSeconds,maxRequests:Number(process.env.SCOUT_MAX_REQUESTS||12),
      maxBytes:Number(process.env.SCOUT_MAX_BYTES||3*1024*1024),databaseLimitBytes:Number(process.env.DATABASE_LIMIT_BYTES||500_000_000),
      maxPending:Number(process.env.SCOUT_MAX_PENDING||10000)}
    validateBatch(config)
    const pending=(await db.query("select count(*)::int n from collection_jobs where status in ('queued','failed','running')")).rows[0].n
    if(pending+2<=config.maxPending){
      await enqueue(db,{kind:'politician',year},1)
      await enqueue(db,{kind:'vote',year,month:year===now.getUTCFullYear()?now.getUTCMonth()+1:12},2)
    }
    // The continuous entrypoint uses the same bounded/fair consumer as the manual CLI.
    // The session lock is reentrant on this connection; generalBatch releases only its own acquisition.
    const result=await generalBatch(db,config,undefined,()=>stop)
    console.log(JSON.stringify(result))
    if(!result.tasks||result.status==='capacity')await sleep(3000)
  } while(!stop && !process.argv.includes('--once'))
} finally { db.release(true);await pool.end() }
