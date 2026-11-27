import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {database,transaction} from '../packages/database/index.ts'
import {backfillPlan,seedBackfill,type BackfillOptions} from '../packages/scout/backfill.ts'
const args=process.argv.slice(2)
for(const a of args)if(!['--apply','--allow-remote'].includes(a)&&!/^--(earliest|limit|kinds|expected-plan)=/.test(a))throw Error('Opção desconhecida')
const get=(key:string,fallback:string)=>args.find(v=>v.startsWith('--'+key+'='))?.slice(key.length+3)??fallback
const options:BackfillOptions={earliest:Number(get('earliest','2023')),limit:Number(get('limit','25')),
 kinds:get('kinds','politician,vote,expense,proposal').split(',') as BackfillOptions['kinds'],maxPending:Number(process.env.SCOUT_MAX_PENDING||10000),databaseLimitBytes:Number(process.env.DATABASE_LIMIT_BYTES||500_000_000)}
const target=new URL(process.env.DATABASE_URL||'')
const local=['localhost','127.0.0.1','[::1]'].includes(target.hostname)
if(!local&&target.searchParams.get('sslmode')!=='verify-full')throw Error('Backfill remoto exige TLS verify-full')
if(target.hostname.endsWith('.pooler.supabase.com')&&target.port!=='5432')throw Error('Backfill exige Session pooler 5432')
const apply=args.includes('--apply'),expected=get('expected-plan','')
if(apply&&(!/^[a-f0-9]{64}$/.test(expected)||(!local&&!args.includes('--allow-remote'))))throw Error('Aplicação exige hash do plano e autorização operacional para remoto')
const pool=database(),db=await pool.connect()
try{await transaction(db,async()=>{
 if(!(await db.query('select pg_try_advisory_xact_lock(6211501) acquired')).rows[0].acquired)throw Error('Outro Scout está ativo')
 const plan=apply?await seedBackfill(db,options,expected):await backfillPlan(db,options)
 await mkdir('.tools/backfill',{recursive:true,mode:0o700})
 const path='.tools/backfill/plan-'+plan.sha256+'.json',text=JSON.stringify(plan,null,2)
 try{await writeFile(path,text,{mode:0o600,flag:'wx'})}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST'||await readFile(path,'utf8')!==text)throw error}
 console.log(JSON.stringify({mode:apply?'seeded':'dry-run',years:plan.years,selected:plan.selected,missingScopes:plan.missingScopes,deferredScopes:plan.deferredScopes,sha256:plan.sha256,path}))
})}finally{db.release();await pool.end()}
