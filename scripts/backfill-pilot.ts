import {mkdir,writeFile} from 'node:fs/promises'
import {database} from '../packages/database/index.ts'
import {coverage} from '../packages/database/coverage.ts'
import {generalBatch} from '../packages/scout/general-batch.ts'
import {enqueue} from '../packages/scout/store.ts'
import {backfillPlan} from '../packages/scout/backfill.ts'
import type {Task} from '../packages/collectors/camara/index.ts'
const target=new URL(process.env.DATABASE_URL||'')
if(!['localhost','127.0.0.1'].includes(target.hostname)||target.pathname!=='/observabr_backfill_validation')throw Error('Piloto exige cópia local dedicada; nunca produção')
const pool=database(),db=await pool.connect()
const audit=async()=>{
 const reports=[]
 for(const kind of ['expense','proposal','vote','ballot'] as const)reports.push(await coverage(db,{kind,year:2026,by:'period',page:1}))
 return {
 counts:(await db.query(`select kind,count(*)::int published,count(distinct owner)::int representatives,
 count(*) filter(where date is null)::int missing_event_date,min(date)::text event_start,max(date)::text event_end from records group by kind order by kind`)).rows,
 queue:(await db.query('select status,count(*)::int tasks from collection_jobs group by status order by status')).rows,
 coverage:reports
}}
try{
 if(!(await db.query('select pg_try_advisory_lock(6211501) acquired')).rows[0].acquired)throw Error('Scout ativo')
 const before=await audit(),at=new Date().toISOString()
 const plan=await backfillPlan(db,{earliest:2023,limit:10,kinds:['politician','vote','expense','proposal'],maxPending:10000,databaseLimitBytes:500000000})
 const tasks:Task[]=[{kind:'politician',year:2026,roster:'period'},{kind:'expense',owner:'204379',year:2026},{kind:'proposal',owner:'204379',year:2026},{kind:'vote',year:2026,month:new Date().getUTCMonth()+1}]
 const runs=[]
 for(const task of tasks){
  await enqueue(db,task)
  runs.push(await generalBatch(db,{kinds:[task.kind],year:2026,month:task.month,owner:task.owner,maxTasks:1,maxSeconds:30,maxRequests:3,maxBytes:512*1024,databaseLimitBytes:500000000,maxPending:10000}))
 }
 const after=await audit()
 const report={at,environment:'isolated PostgreSQL copy; production not changed',before,after,runs,plan:{years:plan.years,missingScopes:plan.missingScopes,selected:plan.selected,sha256:plan.sha256},
  limitations:'Four single-page samples are partial. No institutional coverage percentage or financial absence inferred. Unknown dates remain unknown; official bulk expense source mismatch remains unresolved. Re-running resumes pages instead of replacing this initial baseline.'}
 await mkdir('.tools/backfill',{recursive:true,mode:0o700})
 await writeFile('.tools/backfill/pilot-'+at.replaceAll(':','-')+'.json',JSON.stringify(report,null,2),{flag:'wx',mode:0o600})
 console.log(JSON.stringify({at,before:before.counts,after:after.counts,runs,missingScopes:plan.missingScopes}))
}finally{await db.query('select pg_advisory_unlock(6211501)');db.release();await pool.end()}
