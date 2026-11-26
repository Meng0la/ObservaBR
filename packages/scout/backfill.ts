import {createHash} from 'node:crypto'
import type pg from 'pg'
import {collectionUrl,type Task} from '../collectors/camara/index.ts'
import {enqueue,jobKey} from './store.ts'

export function backfillYears(earliest=2023,now=new Date()){
 const current=now.getUTCFullYear()
 if(!Number.isInteger(earliest)||earliest<2008||earliest>2023||current<2026)throw Error('Período de backfill inválido')
 const years=[current,...Array.from({length:current-2026},(_,i)=>current-i-1),2025,2023,2024]
 for(let year=2022;year>=earliest;year--)years.push(year)
 return years
}
export function taskScope(task:Task,now=new Date()){
 if(task.kind==='ballot')return {from:null,to:null,granularity:'voting_entity'}
 if(task.kind==='politician'&&task.roster!=='period')return {from:null,to:null,granularity:'current_roster_snapshot'}
 const month=task.month??(task.year===now.getUTCFullYear()?now.getUTCMonth()+1:12)
 const from=`${task.year}-${String(task.kind==='vote'?month:1).padStart(2,'0')}-01`
 const end=task.kind==='vote'?new Date(Date.UTC(task.year,month,0)).toISOString().slice(0,10):`${task.year}-12-31`
 const today=now.toISOString().slice(0,10)
 return {from,to:end<today||from>today?end:today,granularity:task.kind==='vote'?'month':'year'}
}
export function refreshDays(task:Task,now=new Date()){
 const year=now.getUTCFullYear(),month=now.getUTCMonth()+1
 if(task.year===year&&(task.kind!=='vote'||(task.month??month)>=month-1))return 1
 if(task.year>=year-1)return 7
 return 30
}
export type BackfillOptions={earliest:number;limit:number;maxPending:number;databaseLimitBytes:number;kinds:Task['kind'][];now?:Date}
export async function backfillPlan(db:pg.PoolClient,options:BackfillOptions){
 const years=backfillYears(options.earliest,options.now)
 if(!Number.isSafeInteger(options.limit)||options.limit<1||options.limit>100||!options.kinds.length||options.kinds.some(k=>!['politician','expense','proposal','vote'].includes(k)))throw Error('Plano de backfill inválido')
 if(!Number.isSafeInteger(options.maxPending)||options.maxPending<1||options.maxPending>100000||!Number.isSafeInteger(options.databaseLimitBytes)||options.databaseLimitBytes<1e6)throw Error('Capacidade inválida')
 const {rows:representatives}=await db.query("select id from records where kind='politician' order by id")
 const keys=new Set((await db.query('select key from collection_jobs')).rows.map(r=>r.key))
 const capacity=(await db.query("select pg_database_size(current_database())::float8 bytes,(select count(*)::int from collection_jobs where status in ('queued','running','failed')) pending")).rows[0]
 const room=capacity.bytes>=options.databaseLimitBytes*.85?0:Math.max(0,Math.min(options.limit,options.maxPending-capacity.pending))
 const tasks:Task[]=[];let missing=0
 const add=(task:Task)=>{collectionUrl(task);if(!keys.has(jobKey(task))){missing++;if(tasks.length<room)tasks.push(task)}}
 // Missing scopes only; never reset failed/done tasks or their page checkpoints.
 for(const year of years){
  if(options.kinds.includes('politician'))add({kind:'politician',year,roster:'period'})
  if(options.kinds.includes('vote'))for(let month=1;month<=(year===(options.now??new Date()).getUTCFullYear()?(options.now??new Date()).getUTCMonth()+1:12);month++)add({kind:'vote',year,month})
  for(const r of representatives)for(const kind of ['expense','proposal'] as const)if(options.kinds.includes(kind))add({kind,owner:r.id,year})
 }
 const plan={version:1,years,indexedRepresentatives:representatives.length,denominator:'indexed roster, not proven full historical membership',missingScopes:missing,selected:tasks.length,
  deferredScopes:missing-tasks.length,pending:capacity.pending,databaseBytes:capacity.bytes,tasks}
 return {...plan,sha256:createHash('sha256').update(JSON.stringify(plan)).digest('hex')}
}
export async function seedBackfill(db:pg.PoolClient,options:BackfillOptions,expected:string){
 const plan=await backfillPlan(db,options)
 if(plan.sha256!==expected)throw Error('Plano mudou; repetir dry-run')
 for(const task of plan.tasks)await enqueue(db,task,30+plan.years.indexOf(task.year))
 return plan
}
