import {database} from '../packages/database/index.ts'
import {generalBatch,validateBatch,type BatchConfig} from '../packages/scout/general-batch.ts'
import {enqueue} from '../packages/scout/store.ts'
import {collectionUrl,type Task} from '../packages/collectors/camara/index.ts'
const args=process.argv.slice(2),get=(name:string,fallback:string)=>args.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback
const kind=get('kind','all'),year=Number(get('year','2025')),month=get('month',''),owner=get('owner','')
const config:BatchConfig={kinds:(kind==='all'?['politician','expense','proposal','vote','ballot']:[kind]) as Task['kind'][],year,
 month:month?Number(month):undefined,owner:owner||undefined,maxTasks:Number(get('max-tasks','3')),maxSeconds:Number(get('max-seconds','180')),
 maxRequests:Number(get('max-requests','12')),maxBytes:Number(get('max-bytes',String(3*1024*1024))),databaseLimitBytes:Number(process.env.DATABASE_LIMIT_BYTES||500_000_000),maxPending:Number(process.env.SCOUT_MAX_PENDING||10000)}
validateBatch(config)
for(const arg of args)if(arg!=='--seed'&&!/^--(kind|year|month|owner|max-tasks|max-seconds|max-requests|max-bytes)=/.test(arg))throw Error('Opção desconhecida')
const target=new URL(process.env.DATABASE_URL||'')
if(target.hostname.endsWith('.pooler.supabase.com')&&target.port!=='5432')throw Error('Scout exige Session pooler na porta 5432')
const pool=database(),db=await pool.connect()
let stopping=false
process.on('SIGTERM',()=>{stopping=true})
process.on('SIGINT',()=>{stopping=true})
try {
 if(args.includes('--seed')){
  if(config.kinds.length!==1)throw Error('Seed exige um tipo específico')
  // No mass discovery is performed by the CLI. Existing page checkpoints are never reset here.
  const task={kind:config.kinds[0],year,month:config.month,owner:config.owner}
  collectionUrl(task)
  const pending=(await db.query("select count(*)::int n from collection_jobs where status in ('queued','failed','running')")).rows[0].n
  if(pending>=config.maxPending)throw Error('Fila atingiu o orçamento; seed não executado')
  await enqueue(db,task)
 }
 const result=await generalBatch(db,config,undefined,()=>stopping)
 console.log(JSON.stringify(result))
 if(result.failures)process.exitCode=1
}finally{db.release(true);await pool.end()}
