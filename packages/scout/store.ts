import {createHash} from 'node:crypto'
import type pg from 'pg'
import type {collect} from '../collectors/camara/index.ts'
import {transaction} from '../database/index.ts'
import {saveSnapshot} from './evidence.ts'
import {publicResponse} from '../security/public-response.ts'

type Page = ReturnType<typeof collect> extends AsyncGenerator<infer P, unknown, unknown> ? P : never
export type Task = Parameters<typeof collect>[0]
export function jobKey(t:Task) {
  return JSON.stringify([t.kind,t.owner??null,t.year,t.month??null,t.name?.toLowerCase()??null])
}
export async function enqueue(db:pg.PoolClient, task:Task, priority=10) {
  await db.query('insert into collection_jobs(key,kind,task,priority) values($1,$2,$3,$4) on conflict do nothing',[jobKey(task),task.kind,task,priority])
}
export async function persist(db:pg.PoolClient, key:string, task:Task, page:Page,verification?:{collectedAt:Date,verifiedAt:Date},cycleId?:string) {
  const hash=createHash('sha256').update(page.raw).digest('hex')
  await transaction(db,async()=>{
    if(cycleId){
      const receipt=await db.query('select sha256 from collection_receipts where cycle_id=$1 and page=$2',[cycleId,page.page])
      if(receipt.rowCount){
        if(receipt.rows[0].sha256!==hash)throw new Error('Página mudou dentro do ciclo; revisar checkpoint')
        return
      }
    }
    if(task.kind==='expense'){
      const previous=await db.query("select id,field from records where kind='expense' and owner=$1 and sha256=$2 and api_url=$3",[task.owner,hash,page.url])
      const ids=new Map(previous.rows.map(row=>[row.field,row.id]))
      if(page.records.some(row=>ids.has(row.field)&&ids.get(row.field)!==row.id))throw new Error('Conciliação de identidade pendente; página preservada sem publicar duplicatas')
    }
    await saveSnapshot(db,{resource:'indexed-page',id:hash,url:page.url,raw:page.raw,payload:JSON.parse(page.raw.toString('utf8')),...verification})
    for(const entry of page.records) {
      const safe=publicResponse({title:entry.title,data:entry.data}).payload as {title:string,data:Record<string,unknown>}
      const r={...entry,...safe}
      const search=[r.title,r.id,...Object.values(r.data).filter(x=>typeof x==='string' && !x.startsWith('http'))].join(' ')
      await db.query(`insert into records(kind,id,owner,title,date,amount,data,source_url,api_url,field,sha256,search_text)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,lower(unaccent($12)))
        on conflict(kind,id) do update set owner=excluded.owner,title=excluded.title,date=excluded.date,
        amount=excluded.amount,data=excluded.data,source_url=excluded.source_url,api_url=excluded.api_url,
        field=excluded.field,sha256=excluded.sha256,verified_at=now(),search_text=excluded.search_text,
        collected_at=case when (records.sha256,records.api_url) is distinct from (excluded.sha256,excluded.api_url) then now() else records.collected_at end
        where not(records.kind='vote' and exists(select 1 from entity_contexts c where c.kind=records.kind and c.external_id=records.id))`,
        [r.kind,r.id,r.owner,r.title,r.date,r.amount,r.data,r.sourceUrl,page.url,r.field,hash,search])
      if(r.kind==='politician') {
        for(const kind of ['expense','proposal'] as const) await enqueue(db,{kind,owner:r.id,year:task.year},task.name?2:20)
      }
      if(r.kind==='vote') await enqueue(db,{kind:'ballot',owner:r.id,year:task.year},15)
    }
    if(cycleId){
      await db.query(`insert into collection_receipts(cycle_id,page,sha256,source_rows,published_rows) values($1,$2,$3,$4,$5)`,[cycleId,page.page,hash,page.sourceRows,page.records.length])
      for(const observation of page.observations)await db.query(`insert into collection_observations(cycle_id,kind,id,sha256,field) values($1,$2,$3,$4,$5) on conflict do nothing`,[cycleId,task.kind,observation.id,hash,observation.field])
      await db.query(`update collection_cycles set source_rows=source_rows+$2,validated_rows=validated_rows+$2,published_rows=published_rows+$3,pages=pages+1 where id=$1`,[cycleId,page.sourceRows,page.records.length])
    }
    if(page.next) {
      await db.query("update collection_jobs set page=$2,status='queued',attempts=0,error=null,updated_at=now() where key=$1",[key,page.page+1])
    } else {
      if(cycleId){
        const continuity=await db.query('select min(page) as first,max(page) as last,count(*)::int as pages from collection_receipts where cycle_id=$1',[cycleId])
        const complete=continuity.rows[0].first===1&&continuity.rows[0].pages===continuity.rows[0].last
        if(complete)await db.query(`insert into collection_absences(cycle_id,kind,id)
          select $1,p.kind,p.id from collection_observations p where p.cycle_id=(select id from collection_cycles where job_key=$2 and completed_at is not null and id<>$1 order by completed_at desc limit 1)
          and not exists(select 1 from collection_observations n where n.cycle_id=$1 and n.kind=p.kind and n.id=p.id) group by p.kind,p.id on conflict do nothing`,[cycleId,key])
        // A cycle resumed from a legacy page is kept partial, never used as proof of removal.
        await db.query("update collection_cycles set status=$2,finished_at=now(),completed_at=case when $2='complete' then now() else null end where id=$1",[cycleId,complete?'complete':'partial'])
      }
      await db.query("update collection_jobs set status='done',page=1,attempts=0,cycle_id=null,error=null,updated_at=now(),due_at=now()+interval '1 day' where key=$1",[key])
      await db.query("update collection_requests set status='done' where job_key=$1",[key])
    }
  })
}
