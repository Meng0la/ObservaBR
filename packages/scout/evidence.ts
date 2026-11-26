import {createHash} from 'node:crypto'
import type pg from 'pg'
import {publicResponse} from '../security/public-response.ts'
export type SnapshotInput={resource:string,id:string,url:string,raw:Buffer,payload:unknown,collectedAt?:Date,verifiedAt?:Date}
export async function saveSnapshot(db:pg.PoolClient,document:SnapshotInput) {
 const sha=createHash('sha256').update(document.raw).digest('hex')
 const id=createHash('sha256').update(document.url+'\n'+sha).digest('hex')
 const publication=publicResponse(JSON.parse(document.raw.toString('utf8')))
 await db.query('insert into source_documents(sha256,raw) values($1,$2) on conflict do nothing',[sha,document.raw])
 await db.query(`insert into api_snapshots(id,resource,external_id,api_url,sha256,payload,original,suppressed_fields,collected_at,verified_at)
 values($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9,now()),coalesce($10,now()))
 on conflict(api_url,sha256) do update set verified_at=greatest(api_snapshots.verified_at,excluded.verified_at),
 payload=excluded.payload,original=excluded.original,suppressed_fields=excluded.suppressed_fields,
 resource=case when api_snapshots.resource='indexed-page' then excluded.resource else api_snapshots.resource end,
 external_id=case when api_snapshots.resource='indexed-page' then excluded.external_id else api_snapshots.external_id end`,
 [id,document.resource,document.id,document.url,sha,JSON.stringify(publication.payload),publication.original,JSON.stringify(publication.suppressedFields),document.collectedAt,document.verifiedAt])
 return id
}
