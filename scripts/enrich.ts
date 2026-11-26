import {z} from 'zod'
import {database} from '../packages/database/index.ts'
import {processEnrichment} from '../packages/scout/enrichment.ts'
const kind=z.enum(['vote','proposal','politician']).parse(process.argv[2])
const id=z.string().min(1).max(100).parse(process.argv[3])
const pool=database()
const db=await pool.connect()
try{
 const lock=await db.query('select pg_try_advisory_lock(6211501) as acquired')
 if(!lock.rows[0].acquired)throw Error('Aguarde o Scout liberar o consumidor')
 await db.query('insert into enrichment_jobs(kind,external_id) values($1,$2) on conflict do nothing',[kind,id])
 await db.query("update enrichment_jobs set status='running',updated_at=now() where kind=$1 and external_id=$2",[kind,id])
 try{await processEnrichment(db,kind,id)}
 catch(error){
  await db.query("update enrichment_jobs set status='failed',error='Falha na coleta complementar',updated_at=now(),run_after=now()+interval '30 minutes' where kind=$1 and external_id=$2",[kind,id])
  throw error
 }
 const result=(await db.query('select status from enrichment_jobs where kind=$1 and external_id=$2',[kind,id])).rows[0]
 console.log(JSON.stringify({kind,id,status:result.status}))
 if(result.status!=='done')process.exitCode=1
}finally{db.release(true);await pool.end()}
