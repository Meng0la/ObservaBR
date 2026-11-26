import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {database} from '../packages/database/index.ts'
import {quotaAlert} from '../packages/scout/metrics.ts'
const pool=database(),db=await pool.connect()
const directory=resolve(process.env.METRICS_DIRECTORY||'.tools/data-engineering/metrics')
try{
 await db.query('begin isolation level repeatable read read only')
 const basic=(await db.query(`select pg_database_size(current_database())::float8 bytes,
  (select count(*)::int from pg_stat_activity where datname=current_database()) connections,
  (select count(*)::int from collection_jobs where status in ('queued','running','failed')) pending`)).rows[0]
 const tables=(await db.query(`select relname name,pg_table_size(relid)::float8 table_bytes,pg_indexes_size(relid)::float8 index_bytes,n_live_tup estimated_rows
  from pg_stat_user_tables where schemaname='observabr' order by pg_total_relation_size(relid) desc`)).rows
 const coverage=(await db.query(`select kind,count(*)::int published,min(date) first_date,max(date) last_date,
  extract(epoch from now()-min(collected_at))::float8 oldest_seconds,avg(pg_column_size(data))::float8 mean_jsonb_bytes
  from records group by kind order by kind`)).rows
 const queues=(await db.query('select kind,status,count(*)::int tasks from collection_jobs group by kind,status order by kind,status')).rows
 const hasRuns=(await db.query("select to_regclass('observabr.collection_runs') is not null available")).rows[0].available
 const runs=hasRuns?(await db.query(`select count(*)::int executions,coalesce(sum(tasks),0)::text tasks,coalesce(sum(pages),0)::text pages,
  coalesce(sum(records),0)::text published_observations,coalesce(sum(failures),0)::text failures,
  coalesce(sum(bytes),0)::text bytes,coalesce(sum(requests),0)::text requests,
  avg(extract(epoch from finished_at-started_at))::float8 mean_seconds,
  sum(pages)/nullif(sum(extract(epoch from finished_at-started_at)),0)::float8 pages_per_second
  from collection_runs where finished_at>=now()-interval '24 hours'`)).rows[0]:null
 const cycles=hasRuns?(await db.query(`select j.kind,c.status,count(*)::int cycles,sum(c.source_rows)::text observed_source_rows,
  sum(c.validated_rows)::text validated_observations,sum(c.published_rows)::text published_observations
  from collection_cycles c join collection_jobs j on j.key=c.job_key group by j.kind,c.status`)).rows:[]
 const quarantine=hasRuns?(await db.query('select count(*)::int n from collection_quarantine')).rows[0].n:null
 await db.query('commit')
 const thresholds=(process.env.ALERT_THRESHOLDS||'70,85,95').split(',').map(Number)
 const alerts={database:quotaAlert(basic.bytes,Number(process.env.DATABASE_LIMIT_BYTES||500_000_000),thresholds),pending:quotaAlert(basic.pending,Number(process.env.SCOUT_MAX_PENDING||10000),thresholds)}
 const at=new Date().toISOString(),path=resolve(directory,'latest.json')
 let growth:null|{elapsedSeconds:number,bytesDelta:number,bytesPerDay:number}=null
 try{const previous=JSON.parse(await readFile(path,'utf8')),elapsedSeconds=(Date.parse(at)-Date.parse(previous.at))/1000;
  if(elapsedSeconds>0)growth={elapsedSeconds,bytesDelta:basic.bytes-previous.basic.bytes,bytesPerDay:(basic.bytes-previous.basic.bytes)*86400/elapsedSeconds}
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
 const report={at,basic,tables,coverage,queues,runs,cycles,quarantine,growth,alerts,limitations:'Source totals are observed rows, not an independently proven institutional total. A partial cycle never proves full coverage. Connection count includes other database clients.'}
 await mkdir(directory,{recursive:true,mode:0o700})
 const json=JSON.stringify(report,null,2)
 await writeFile(resolve(directory,at.replaceAll(':','-')+'.json'),json,{flag:'wx',mode:0o600})
 await writeFile(path,json,{mode:0o600})
 console.log(JSON.stringify({at,basic,alerts,growth}))
 if(Object.values(alerts).some(alert=>alert.level==='critical'))process.exitCode=2
}finally{db.release();await pool.end()}
