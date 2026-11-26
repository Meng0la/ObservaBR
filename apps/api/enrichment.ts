import type {FastifyInstance} from 'fastify'
import type pg from 'pg'
import {z} from 'zod'
import {recordId} from '../../packages/database/record-id.ts'

const entity=z.object({kind:z.enum(['politician','expense','proposal','vote','ballot','body','event']),id:z.string().min(1).max(180)})
const voteId=z.object({id:z.string().regex(/^[1-9]\d{0,13}-\d{1,10}$/)})
function relations(kind:string,id:string,data:Record<string,unknown>) {
 const result:Array<{kind:string,id:string,title:string}>=[]
 if(kind==='ballot'&&typeof data.voteId==='string')result.push({kind:'vote',id:data.voteId,title:'Votação relacionada'})
 if(typeof data.proposalId==='string')result.push({kind:'proposal',id:data.proposalId,title:'Proposição relacionada'})
 if(typeof data.referencedBy==='string')result.push({kind:'vote',id:data.referencedBy,title:'Votação que referencia esta proposição'})
 return result
}
const published=`s.id,s.resource,case when s.resource='indexed-page' then null else s.external_id end as "externalId",s.payload,s.original,s.suppressed_fields as "suppressedFields",
 s.api_url,s.api_url as source_url,s.sha256,s.collected_at,s.verified_at,s.collector_version,
 'GET' as method,'Câmara dos Deputados' as institution,'collected' as verification_status`

export function enrichmentRoutes(api:FastifyInstance,db:pg.Pool) {
 api.post('/api/enrichment',{config:{rateLimit:{max:10,timeWindow:'1 hour'}}},async(req,reply)=>{
  const p=z.object({kind:z.enum(['vote','proposal','politician']),id:z.string().min(1).max(100)}).strict().parse(req.body)
  const record=await db.query("select id from records where kind=$1 and (id=$2 or ($1='proposal' and data->>'proposalId'=$2)) order by (id=$2) desc,id limit 1",[p.kind,p.id])
  if(!record.rowCount)return reply.code(404).send({error:'Registro ainda não indexado'})
  p.id=record.rows[0].id
  await db.query('insert into enrichment_jobs(kind,external_id) values($1,$2) on conflict do nothing',[p.kind,p.id])
  const job=await db.query('select kind,external_id,status,updated_at,run_after from enrichment_jobs where kind=$1 and external_id=$2',[p.kind,p.id])
  return reply.code(202).send(job.rows[0])
 })
 api.get('/api/votes/:id',async(req,reply)=>{
  const p=voteId.parse(req.params)
  const [record,context,job,counts,parties,ufs]=await Promise.all([
   db.query("select * from records where kind='vote' and id=$1",[p.id]),
   db.query("select context,updated_at from entity_contexts where kind='vote' and external_id=$1",[p.id]),
   db.query("select status,updated_at,run_after from enrichment_jobs where kind='vote' and external_id=$1",[p.id]),
   db.query("select data->>'vote' as vote,count(*)::int as count from records where kind='ballot' and data->>'voteId'=$1 group by 1 order by 1",[p.id]),
   db.query("select data->>'party' as party,data->>'vote' as vote,count(*)::int as count from records where kind='ballot' and data->>'voteId'=$1 group by 1,2 order by 1,2",[p.id]),
   db.query("select distinct data->>'uf' as uf from records where kind='ballot' and data->>'voteId'=$1 and data->>'uf' is not null order by 1",[p.id])
  ])
  if(!record.rowCount)return reply.code(404).send({error:'Votação ainda não indexada'})
  delete record.rows[0].search_text
  return {record:record.rows[0],context:context.rows[0]?.context??null,updated_at:context.rows[0]?.updated_at??null,ufs:ufs.rows.map(row=>row.uf),
   job:job.rows[0]??null,ballotCounts:counts.rows,partyCounts:parties.rows,
   nominalTotal:counts.rows.reduce((n,r)=>n+r.count,0)}
 })
 api.get('/api/evidence/:kind/:id',async(req,reply)=>{
  const p=entity.parse(req.params)
  p.id=await recordId(db,p.kind,p.id)
  let normalized
  if(['body','event'].includes(p.kind)){
   const cached=await db.query('select payload from api_snapshots where resource=$1 and external_id=$2 order by verified_at desc limit 1',[p.kind,p.id])
   if(cached.rowCount)normalized={kind:p.kind,id:p.id,title:cached.rows[0].payload.dados.nome||cached.rows[0].payload.dados.descricaoTipo||'Evento institucional',data:cached.rows[0].payload.dados}
  }else normalized=(await db.query("select * from records where kind=$1 and (id=$2 or ($1='proposal' and data->>'proposalId'=$2)) order by (id=$2) desc,id limit 1",[p.kind,p.id])).rows[0]
  if(!normalized)return reply.code(404).send({error:'Registro ainda não indexado'})
  p.id=normalized.id
  delete normalized.search_text
  const documents=await db.query(`select distinct ${published} from api_snapshots s
   where (s.sha256=$3 and s.api_url=$4)
   or s.id in(select snapshot_id from enrichment_documents where kind=$1 and external_id=$2)
   or ($1 in ('body','event') and s.resource=$1 and s.external_id=$2)
   order by s.collected_at desc limit 31`,[p.kind,p.id,normalized.sha256??null,normalized.api_url??null])
  const context=(await db.query('select context from entity_contexts where kind=$1 and external_id=$2',[p.kind,p.id])).rows[0]?.context
  if(context)normalized.data={...normalized.data,context}
  const related=relations(p.kind,p.id,normalized.data)
  if(normalized.owner)related.push({kind:'politician',id:normalized.owner,title:'Perfil do representante'})
  if(context?.mainProposal)related.push({kind:'proposal',id:context.mainProposal.id,title:context.mainProposal.label})
  if(context?.body?.id)related.push({kind:'body',id:context.body.id,title:context.body.name||context.body.acronym})
  if(context?.eventId)related.push({kind:'event',id:context.eventId,title:'Sessão legislativa'})
  let bytes=0
  const included=[]
  for(const document of documents.rows){
   if(document.resource==='indexed-page'){
    document.projection_version=document.collector_version
    document.collector_version=normalized.collector_version||null
   }
   const size=Buffer.byteLength(JSON.stringify(document))
   if(bytes+size>8*1024*1024||included.length===30)break
   included.push(document)
   bytes+=size
  }
  return {entity_type:p.kind,normalized,documents:included,documentsTruncated:included.length<documents.rows.length,relations:related}
 })
 api.get('/api/entities/:kind/:id',async(req,reply)=>{
  const p=z.object({kind:z.enum(['body','event']),id:z.string().regex(/^[1-9]\d{0,13}$/)}).parse(req.params)
  const row=await db.query('select payload,api_url,verified_at from api_snapshots where resource=$1 and external_id=$2 order by verified_at desc limit 1',[p.kind,p.id])
  return row.rows[0]??reply.code(404).send({error:'Documento institucional ainda não indexado'})
 })
}
