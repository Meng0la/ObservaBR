import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import limiter from '@fastify/rate-limit'
import staticFiles from '@fastify/static'
import {resolve} from 'node:path'
import {existsSync} from 'node:fs'
import type pg from 'pg'
import {z,ZodError} from 'zod'
import {enrichmentRoutes} from './enrichment.ts'
import {recordId} from '../../packages/database/record-id.ts'
import {coverage} from '../../packages/database/coverage.ts'

const kinds=z.enum(['politician','expense','proposal','vote','ballot'])
const id=z.string().trim().min(1).max(250)
const sortFields={
  'name-asc':'lower(unaccent(title)) asc nulls last',
  'name-desc':'lower(unaccent(title)) desc nulls last',
  'date-asc':'date asc nulls last',
  'date-desc':'date desc nulls last',
  'amount-asc':'amount asc nulls last',
  'amount-desc':'amount desc nulls last'
} as const
const sort=z.enum(['name-asc','name-desc','date-asc','date-desc','amount-asc','amount-desc'])
const search=z.object({
  q:z.string().trim().max(150).default(''),kind:kinds.optional(),owner:id.optional(),voteId:id.optional(),vote:z.string().min(1).max(80).optional(),
  uf:z.string().regex(/^[A-Z]{2}$/).optional(),from:z.iso.date().optional(),to:z.iso.date().optional(),
  party:z.string().trim().min(1).max(80).optional(),sort:sort.optional(),
  page:z.coerce.number().int().min(1).max(40000).default(1),format:z.enum(['json','csv']).optional()
}).refine(v=>!v.from||!v.to||v.from<=v.to)
const fields='kind,id,owner,title,to_char(date,\'YYYY-MM-DD\') as date,amount,data,source_url,api_url,sha256,collected_at,verified_at,field,collector_version'
export function csv(rows:Record<string,unknown>[]) {
  const keys=['kind','id','owner','title','date','amount','source_url','api_url','sha256','collected_at','verified_at','field','collector_version']
  const cell=(v:unknown)=>{
    const s=v instanceof Date?v.toISOString():String(v??'')
    return '"'+(/^[\s]*[=+@-]/.test(s)?"'":'')+s.replaceAll('"','""')+'"'
  }
  return [keys.join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n')
}
export async function app(db:pg.Pool) {
  const coverageCache=new Map<string,{expires:number,value:unknown}>()
  let coverageActive=0
  const api=Fastify({bodyLimit:4096,disableRequestLogging:true,logger:{redact:['req.headers.authorization','req.headers.cookie']}})
  await api.register(helmet,{contentSecurityPolicy:{directives:{
    defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],
    workerSrc:["'self'","blob:"],imgSrc:["'self'","data:","blob:","https://www.camara.leg.br","https://www.camara.leg.br/internet/"],
    connectSrc:["'self'","blob:"],upgradeInsecureRequests:null}}})
  await api.register(limiter,{max:180,timeWindow:'1 minute'})
  enrichmentRoutes(api,db)
  api.setErrorHandler((err,req,reply)=>{
    if(err instanceof ZodError) return reply.code(400).send({error:'Parâmetros inválidos'})
    const e=err as Error & {statusCode?:number,code?:string}
    if(e.code==='23505') return reply.code(409).send({error:'Consulta já enfileirada'})
    const status=e.statusCode??503
    req.log.warn({code:e.code,status},'Falha na solicitação')
    reply.code(status).send({error:status===429?'Limite de consultas atingido':'Solicitação indisponível'})
  })
  api.get('/api/health',async()=>{await db.query('select 1');return {status:'ok'}})
  api.get('/api/coverage',{config:{rateLimit:{max:12,timeWindow:'1 minute'}}},async (request,reply)=>{
    const query=z.object({kind:kinds.default('expense'),year:z.coerce.number().int().min(2008).max(new Date().getUTCFullYear()).default(new Date().getUTCFullYear()),
      by:z.enum(['representative','source','category','period']).default('representative'),owner:z.string().regex(/^[1-9]\d{0,13}$/).optional(),
      page:z.coerce.number().int().min(1).max(100).default(1)}).strict().parse(request.query)
    const key=JSON.stringify(query),now=Date.now(),cached=coverageCache.get(key)
    if(cached&&cached.expires>now){reply.header('Cache-Control','public, max-age=30');return cached.value}
    if(cached)coverageCache.delete(key)
    if(coverageActive>=2)return reply.code(503).header('Retry-After','1').send({error:'Consulta temporariamente ocupada'})
    coverageActive++
    let client:pg.PoolClient|undefined
    try{
      client=await db.connect()
      await client.query('begin isolation level repeatable read read only')
      await client.query("set local statement_timeout='5s'")
      const result=await coverage(client,query)
      await client.query('commit')
      for(const [cacheKey,entry] of coverageCache)if(entry.expires<=now)coverageCache.delete(cacheKey)
      if(coverageCache.size>=64)coverageCache.delete(coverageCache.keys().next().value!)
      coverageCache.set(key,{expires:now+30_000,value:result})
      reply.header('Cache-Control','public, max-age=30')
      return result
    }catch(error){if(client)await client.query('rollback');throw error}finally{client?.release();coverageActive--}
  })
  api.get('/api/summary',async()=>{
    const [counts,states,jobs,coverage,parties]=await Promise.all([
      db.query(`select kind,count(distinct case when kind='proposal' then coalesce(data->>'proposalId',id) else id end)::int as n,
        count(owner)::int as links,max(verified_at) as last,
        to_char(min(date),'YYYY-MM-DD') as "from",to_char(max(date),'YYYY-MM-DD') as "to" from records group by kind order by kind`),
      db.query("select data->>'uf' as uf,count(*)::int as count from records where kind='politician' and data->>'uf' is not null group by 1 order by 1"),
      db.query("select kind,status,updated_at,task->>'year' as year,page from collection_jobs where status<>'queued' order by updated_at desc limit 20"),
      db.query(`select kind,count(*) filter(where status='done')::int as done,
        count(*) filter(where status='failed')::int as failed,count(*) filter(where status='running')::int as running,
        count(*) filter(where status='queued')::int as queued,min((task->>'year')::int) as earliest,
        max((task->>'year')::int) as latest
        from collection_jobs group by kind order by kind`),
      db.query("select distinct data->>'party' as party from records where kind='politician' and trim(data->>'party')<>'' order by party")
    ])
    return {counts:{...Object.fromEntries(kinds.options.map(k=>[k,0])),...Object.fromEntries(counts.rows.map(r=>[r.kind,r.n])),
      proposalLinks:counts.rows.find(r=>r.kind==='proposal')?.links??0},
      states:states.rows,jobs:jobs.rows,parties:parties.rows.map(r=>r.party),
      periods:counts.rows.map(r=>({kind:r.kind,from:r.from,to:r.to})),
      coverage:coverage.rows,lastVerified:counts.rows.reduce((latest,r)=>!latest||r.last>latest?r.last:latest,null)}
  })
  api.get('/api/records',async(req,reply)=>{
    const q=search.parse(req.query)
    const args:unknown[]=[]
    const terms:string[]=[]
    function bind(v:unknown) {args.push(v);return '$'+args.length}
    if(q.kind) terms.push('kind='+bind(q.kind))
    if(q.owner) terms.push('owner='+bind(q.owner))
    if(q.voteId) terms.push("data->>'voteId'="+bind(q.voteId))
    if(q.vote) terms.push("data->>'vote'="+bind(q.vote))
    if(q.uf) {
      const uf=bind(q.uf)
      terms.push(q.kind==='ballot'?"data->>'uf'="+uf:`((kind='politician' and data->>'uf'=${uf}) or owner in (select p.id from records p where p.kind='politician' and p.data->>'uf'=${uf}))`)
    }
    if(q.party) {
      const party=bind(q.party)
      terms.push(q.kind==='ballot'?"data->>'party'="+party:`((kind='politician' and data->>'party'=${party}) or owner in (select p.id from records p where p.kind='politician' and p.data->>'party'=${party}))`)
    }
    if(q.from) terms.push('date>='+bind(q.from))
    if(q.to) terms.push('date<='+bind(q.to))
    let order=(sortFields[q.sort??'date-desc'])+',title,kind,id'
    if(q.q) {
      const param='lower(unaccent('+bind(q.q)+'::text))'
      terms.push(`(strpos(search_text,${param})>0 or ${param} <% search_text or to_tsvector('portuguese',search_text) @@ plainto_tsquery('portuguese',${param}))`)
      if(!q.sort) order=`word_similarity(${param},search_text) desc,${order}`
    }
    const where=terms.length?' where '+terms.join(' and '):''
    const total=await db.query('select count(*)::int as total from records'+where,args)
    const offset=bind((q.page-1)*25)
    const items=await db.query('select '+fields+' from records'+where+' order by '+order+' limit 25 offset '+offset,args)
    if(q.format==='csv') return reply.header('Content-Disposition','attachment; filename="observabr-pagina.csv"').type('text/csv; charset=utf-8').send(csv(items.rows))
    if(q.format==='json') reply.header('Content-Disposition','attachment; filename="observabr-pagina.json"')
    return {items:items.rows,total:total.rows[0].total,page:q.page,pageSize:25}
  })
  api.get('/api/records/:kind/:id',async(req,reply)=>{
    const p=z.object({kind:kinds,id}).parse(req.params)
    p.id=await recordId(db,p.kind,p.id)
    const result=await db.query('select '+fields+" from records where kind=$1 and (id=$2 or ($1='proposal' and data->>'proposalId'=$2)) order by (id=$2) desc,id limit 1",[p.kind,p.id])
    return result.rows[0]??reply.code(404).send({error:'Registro ausente no índice'})
  })
  api.get('/api/history/:owner',async(req)=>{
    const p=z.object({owner:id}).parse(req.params)
    return (await db.query(`select to_char(make_date((data->>'year')::int,(data->>'month')::int,1),'YYYY-MM') as month,sum(amount) as amount
      from records where kind='expense' and owner=$1 and amount is not null and data->>'month' is not null and data->>'year' is not null group by 1 order by 1`,[p.owner])).rows
  })
  api.post('/api/requests',{config:{rateLimit:{max:3,timeWindow:'1 hour'}}},async(req,reply)=>{
    const {name}=z.object({name:z.string().trim().min(3).max(100).regex(/^[\p{L}\p{M} '\-]+$/u)}).strict().parse(req.body)
    const r=await db.query('insert into collection_requests(name) values($1) returning id,status',[name])
    return reply.code(202).send(r.rows[0])
  })
  api.get('/api/requests/:id',async(req,reply)=>{
    const p=z.object({id:z.uuid()}).parse(req.params)
    const r=await db.query('select id,status,requested_at from collection_requests where id=$1',[p.id])
    return r.rows[0]??reply.code(404).send({error:'Solicitação ausente'})
  })
  const root=resolve('apps/web/dist')
  if(existsSync(root)) await api.register(staticFiles,{root})
  return api
}
