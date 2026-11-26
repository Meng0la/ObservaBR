import type pg from 'pg'
import {createHash} from 'node:crypto'
import {enrichVote,fetchResource,resourceUrl,type Resource,type SourceDocument} from '../collectors/camara/enrichment.ts'
import {parsePage} from '../collectors/camara/index.ts'
import {saveSnapshot} from './evidence.ts'
import {persist,jobKey} from './store.ts'
import {transaction} from '../database/index.ts'
import {publicResponse} from '../security/public-response.ts'

export async function processEnrichment(db:pg.PoolClient,kind:string,id:string,fetcher:typeof fetchResource=fetchResource) {
 const snapshotIds=new Set<string>()
 async function reader(resource:Resource,externalId:string):Promise<SourceDocument> {
  resourceUrl(resource,externalId)
  const cached=await db.query(`select s.id,s.sha256,s.api_url,d.raw from api_snapshots s join source_documents d on d.sha256=s.sha256
   where s.resource=$1 and s.external_id=$2 and s.verified_at>now()-interval '24 hours' order by s.verified_at desc limit 1`,[resource,externalId])
  if(cached.rowCount){
   snapshotIds.add(cached.rows[0].id)
   const raw=cached.rows[0].raw as Buffer
   if(createHash('sha256').update(raw).digest('hex')!==cached.rows[0].sha256)throw Error('Integridade do cache inválida')
   return {resource,id:externalId,url:cached.rows[0].api_url,raw,payload:JSON.parse(raw.toString('utf8'))}
  }
  const doc=await fetcher(resource,externalId)
  const snapshot=await transaction(db,()=>saveSnapshot(db,doc))
  snapshotIds.add(snapshot)
  return doc
 }
 const base=(await db.query('select * from records where kind=$1 and id=$2',[kind,id])).rows[0]
 if(!base)throw Error('Entidade não indexada')
 let documents:SourceDocument[]
 let context:unknown
 let partial=false
 if(kind==='vote'){
  const result=await enrichVote(id,reader)
  documents=result.documents
  context=result.context
  partial=result.retrievalIssues.length>0
  const ballots=documents.find(d=>d.resource==='votes')
  if(ballots){
   const task={kind:'ballot' as const,owner:id,year:Number(result.context.date?.slice(0,4)||new Date().getUTCFullYear())}
   const proof=(await db.query('select collected_at,verified_at from api_snapshots where api_url=$1 order by verified_at desc limit 1',[ballots.url])).rows[0]
   await persist(db,jobKey(task),task,parsePage(ballots.raw,task,1,ballots.url),{collectedAt:proof.collected_at,verifiedAt:proof.verified_at})
  }
 }else if(kind==='proposal'){
  const externalId=String(base.data.proposalId||id.split(':')[0])
  documents=[]
  for(const resource of ['proposal','authors','proceedings'] as const)documents.push(await reader(resource,externalId))
  context={sources:documents.map(d=>({resource:d.resource,id:d.id,url:d.url,field:'/dados'}))}
 }else if(kind==='politician'){
  // The indexed public list is already available to the Explorer. No arbitrary profile URL is fetched.
  context={issues:['O cadastro institucional indexado está disponível na resposta coletada.']}
  documents=[]
 }else throw Error('Tipo de enriquecimento não suportado')
 await transaction(db,async()=>{
  for(const doc of documents){
   const snapshotId=(await db.query('select id from api_snapshots where api_url=$1 and sha256=$2',
    [doc.url,createHash('sha256').update(doc.raw).digest('hex')])).rows[0].id as string
   snapshotIds.add(snapshotId)
   if(doc.resource==='proposal'){
    const data=(publicResponse(doc.payload).payload as {dados:Record<string,unknown>}).dados
    const title=[data.siglaTipo,data.numero+'/'+String(data.ano)].join(' ')
    const proof=(await db.query('select sha256,collected_at,verified_at from api_snapshots where id=$1',[snapshotId])).rows[0]
    await db.query(`insert into records(kind,id,title,date,data,source_url,api_url,field,sha256,search_text,collected_at,verified_at,collector_version)
     values('proposal',$1,$2,$3,$4,$5,$5,'/dados',$6,lower(unaccent($7)),$8,$9,'2.0.0')
     on conflict(kind,id) do update set title=excluded.title,data=excluded.data,date=excluded.date,source_url=excluded.source_url,field=excluded.field,sha256=excluded.sha256,verified_at=excluded.verified_at,collected_at=excluded.collected_at,collector_version=excluded.collector_version,api_url=excluded.api_url,search_text=excluded.search_text`,
     [doc.id,title,typeof data.dataApresentacao==='string'?data.dataApresentacao.slice(0,10):null,
      {proposalId:doc.id,summary:data.ementa??null,year:data.ano},doc.url,proof.sha256,title+' '+String(data.ementa??''),proof.collected_at,proof.verified_at])
    await db.query('insert into enrichment_documents(kind,external_id,snapshot_id) values($1,$2,$3) on conflict do nothing',['proposal',doc.id,snapshotId])
   }
  }
  for(const snapshotId of snapshotIds)await db.query('insert into enrichment_documents(kind,external_id,snapshot_id) values($1,$2,$3) on conflict do nothing',[kind,id,snapshotId])
  await db.query(`insert into data_revisions(kind,id,previous)
    select kind||'_context',external_id,jsonb_build_object('context',context,'updated_at',updated_at)
    from entity_contexts where kind=$1 and external_id=$2 and context is distinct from $3::jsonb`,[kind,id,JSON.stringify(context)])
  await db.query(`insert into entity_contexts(kind,external_id,context) values($1,$2,$3)
   on conflict(kind,external_id) do update set context=excluded.context,updated_at=now()`,[kind,id,JSON.stringify(context)])
  if(kind==='vote'){
   const value=context as Awaited<ReturnType<typeof enrichVote>>['context']
   const data={...base.data,object:value.object,description:value.result,body:value.body.name||value.body.acronym}
   const detail=documents.find(document=>document.resource==='vote')!
   const proof=(await db.query('select sha256,collected_at,verified_at from api_snapshots where api_url=$1 order by verified_at desc limit 1',[detail.url])).rows[0]
   for(const related of value.related){
    if(!related.id||!related.label)continue
    await db.query(`insert into records(kind,id,title,data,source_url,api_url,field,sha256,search_text,collected_at,verified_at,collector_version)
      values('proposal',$1,$2,$3,$4,$4,$5,$6,lower(unaccent($7)),$8,$9,'2.0.0')
      on conflict(kind,id) do update set title=excluded.title,data=excluded.data,source_url=excluded.source_url,
       api_url=excluded.api_url,field=excluded.field,sha256=excluded.sha256,search_text=excluded.search_text,
       collected_at=excluded.collected_at,verified_at=excluded.verified_at,collector_version=excluded.collector_version
      where records.data->>'detailPending'='true'`,
      [related.id,related.label,{proposalId:related.id,summary:related.summary,detailPending:true,referencedBy:id},
       detail.url,related.field,proof.sha256,related.label+' '+(related.summary||''),proof.collected_at,proof.verified_at])
   }
   await db.query(`update records set title=$2,data=$3,search_text=lower(unaccent($4)),verified_at=$8,
    sha256=$5,api_url=$6,source_url=$6,field='/dados',collected_at=$7,collector_version='2.0.0' where kind='vote' and id=$1`,
    [id,value.title,data,value.title+' '+JSON.stringify(context),proof.sha256,detail.url,proof.collected_at,proof.verified_at])
  }
  await db.query(`update enrichment_jobs set status=$3,updated_at=now(),run_after=now()+case when $3='done' then interval '24 hours' else interval '30 minutes' end,
   error=case when $3='done' then null else 'Coleta complementar parcial' end where kind=$1 and external_id=$2`,[kind,id,partial?'failed':'done'])
 })
}

export async function runNextEnrichment(db:pg.PoolClient) {
 const result=await db.query('select kind,external_id from enrichment_jobs where run_after<=now() order by run_after,kind,external_id limit 1')
 if(!result.rowCount)return false
 const job=result.rows[0]
 await db.query("update enrichment_jobs set status='running',updated_at=now() where kind=$1 and external_id=$2",[job.kind,job.external_id])
 try{await processEnrichment(db,job.kind,job.external_id)}
 catch{
  await db.query("update enrichment_jobs set status='failed',updated_at=now(),error='Falha na coleta complementar',run_after=now()+interval '30 minutes' where kind=$1 and external_id=$2",[job.kind,job.external_id])
  throw Error('Falha no enriquecimento '+job.kind+' '+job.external_id)
 }
 return true
}
