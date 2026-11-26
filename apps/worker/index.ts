import {setTimeout as sleep} from 'node:timers/promises'
import {database,transaction} from '../../packages/database/index.ts'
import {collect} from '../../packages/collectors/camara/index.ts'
import {enqueue,jobKey,persist,type Task} from '../../packages/scout/store.ts'
import {runNextEnrichment} from '../../packages/scout/enrichment.ts'

const pool=database()
const db=await pool.connect()
let stop=false
process.on('SIGTERM',()=>{stop=true})
process.on('SIGINT',()=>{stop=true})
try {
  const lock=await db.query('select pg_try_advisory_lock(6211501) as acquired')
  if(!lock.rows[0].acquired) throw new Error('Outro Scout está consumindo a fila')
  await db.query("update collection_jobs set status='queued' where status='running'")
  do {
    try {
      if(await runNextEnrichment(db)) {
        if(process.argv.includes('--once')||process.argv.includes('--enrichment-once'))break
        continue
      }
    } catch(error) { console.error(error instanceof Error?error.message:'Falha no enriquecimento') }
    if(process.argv.includes('--enrichment-once'))break
    const now=new Date()
    const year=Number(process.env.COLLECTION_YEAR||now.getUTCFullYear())
    if(!Number.isInteger(year)||year<2008||year>now.getUTCFullYear()) throw new Error('COLLECTION_YEAR inválido')
    await enqueue(db,{kind:'politician',year},1)
    await enqueue(db,{kind:'vote',year,month:year===now.getUTCFullYear()?now.getUTCMonth()+1:12},2)
    await transaction(db,async()=>{
      const requests=await db.query("select id,name from collection_requests where status='queued' order by requested_at limit 5 for update")
      for(const request of requests.rows) {
        const task:Task={kind:'politician',name:request.name,year}
        await enqueue(db,task,0)
        await db.query("update collection_requests r set status=j.status,job_key=j.key from collection_jobs j where r.id=$1 and j.key=$2",[request.id,jobKey(task)])
        await db.query("update collection_requests set status='running' where id=$1 and status='queued'",[request.id])
      }
    })
    const next=await db.query("select * from collection_jobs where due_at<=now() order by priority,due_at,key limit 1")
    const job=next.rows[0]
    if(!job) {await sleep(3000);continue}
    await db.query("update collection_jobs set status='running',updated_at=now() where key=$1",[job.key])
    try {
      for await(const page of collect(job.task,job.page)) {
        await persist(db,job.key,job.task,page)
        if(stop) break
      }
      if(stop) break
    } catch(e) {
      const detail=e instanceof Error?e.message.slice(0,240):'falha de coleta'
      console.error(JSON.stringify({kind:job.kind,page:job.page,error:detail}))
      await db.query("update collection_jobs set status='failed',updated_at=now(),error=$2,due_at=now()+interval '30 minutes' where key=$1",[job.key,detail])
    }
    await db.query("update collection_requests r set status=j.status from collection_jobs j where r.job_key=j.key and j.key=$1",[job.key])
  } while(!stop && !process.argv.includes('--once'))
} finally { db.release(true);await pool.end() }
