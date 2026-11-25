import {createHash} from 'node:crypto'
import type pg from 'pg'
import type {collect} from '../collectors/camara/index.ts'
import {transaction} from '../database/index.ts'

type Page = ReturnType<typeof collect> extends AsyncGenerator<infer P, unknown, unknown> ? P : never
export type Task = Parameters<typeof collect>[0]
export function jobKey(t:Task) {
  return JSON.stringify([t.kind,t.owner??null,t.year,t.month??null,t.name?.toLowerCase()??null])
}
export async function enqueue(db:pg.PoolClient, task:Task, priority=10) {
  await db.query('insert into collection_jobs(key,kind,task,priority) values($1,$2,$3,$4) on conflict do nothing',[jobKey(task),task.kind,task,priority])
}
export async function persist(db:pg.PoolClient, key:string, task:Task, page:Page) {
  const hash=createHash('sha256').update(page.raw).digest('hex')
  await transaction(db,async()=>{
    await db.query('insert into source_documents(sha256,raw) values($1,$2) on conflict do nothing',[hash,page.raw])
    for(const r of page.records) {
      const search=[r.title,r.id,...Object.values(r.data).filter(x=>typeof x==='string' && !x.startsWith('http'))].join(' ')
      await db.query(`insert into records(kind,id,owner,title,date,amount,data,source_url,api_url,field,sha256,search_text)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,lower(unaccent($12)))
        on conflict(kind,id) do update set owner=excluded.owner,title=excluded.title,date=excluded.date,
        amount=excluded.amount,data=excluded.data,source_url=excluded.source_url,api_url=excluded.api_url,
        field=excluded.field,sha256=excluded.sha256,verified_at=now(),search_text=excluded.search_text,
        collected_at=case when (records.sha256,records.api_url) is distinct from (excluded.sha256,excluded.api_url) then now() else records.collected_at end`,
        [r.kind,r.id,r.owner,r.title,r.date,r.amount,r.data,r.sourceUrl,page.url,r.field,hash,search])
      if(r.kind==='politician') {
        for(const kind of ['expense','proposal'] as const) await enqueue(db,{kind,owner:r.id,year:task.year},task.name?2:20)
      }
      if(r.kind==='vote') await enqueue(db,{kind:'ballot',owner:r.id,year:task.year},15)
    }
    if(page.next && task.kind!=='ballot') {
      await db.query('update collection_jobs set page=$2,updated_at=now() where key=$1',[key,page.page+1])
    } else {
      await db.query("update collection_jobs set status='done',page=1,error=null,updated_at=now(),due_at=now()+interval '1 day' where key=$1",[key])
      await db.query("update collection_requests set status='done' where job_key=$1",[key])
    }
  })
}
