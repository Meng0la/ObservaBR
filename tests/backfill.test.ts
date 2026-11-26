import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomInt} from 'node:crypto'
import pg from 'pg'
import {backfillYears,taskScope,refreshDays,backfillPlan,seedBackfill} from '../packages/scout/backfill.ts'
import {enqueue,jobKey,persist} from '../packages/scout/store.ts'
import {generalBatch} from '../packages/scout/general-batch.ts'
import {collectionUrl,parsePage,type Task} from '../packages/collectors/camara/index.ts'
import {app} from '../apps/api/app.ts'

const now=new Date('2026-11-26T12:00:00Z')
test('backfill ordena períodos e distingue competência, entidade e verificação recorrente',()=>{
 assert.deepEqual(backfillYears(2023,now),[2026,2025,2023,2024])
 assert.deepEqual(backfillYears(2021,now),[2026,2025,2023,2024,2022,2021])
 assert.throws(()=>backfillYears(2007,now))
 assert.deepEqual(taskScope({kind:'expense',owner:'123',year:2026},now),{from:'2026-01-01',to:'2026-11-26',granularity:'year'})
 assert.equal(taskScope({kind:'ballot',owner:'1-2',year:2025},now).from,null)
 assert.equal(refreshDays({kind:'vote',year:2026,month:11},now),1)
 assert.equal(refreshDays({kind:'vote',year:2026,month:1},now),7)
 assert.equal(refreshDays({kind:'expense',year:2023,owner:'123'},now),30)
})
const pool=()=>new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path=observabr,public,extensions'})
test('cadastro histórico não substitui a filiação do perfil atual',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const p=pool(),db=await p.connect(),id=String(randomInt(100000000,999999999))
 const current:Task={kind:'politician',name:id,year:2026},historical:Task={...current,year:2023,roster:'period'}
 const raw=(party:string)=>Buffer.from(JSON.stringify({dados:[{id,nome:'Parlamentar de teste',siglaPartido:party,siglaUf:'DF'}],links:[]}))
 try{
  for(const [task,party] of [[current,'A'],[historical,'B']] as const){await enqueue(db,task);await persist(db,jobKey(task),task,parsePage(raw(party),task,1,collectionUrl(task).href))}
  assert.equal((await db.query("select data->>'party' party from records where kind='politician' and id=$1",[id])).rows[0].party,'A')
 }finally{
  await db.query("delete from collection_jobs where task->>'owner'=$1 or key=any($2)",[id,[jobKey(current),jobKey(historical)]])
  await db.query("delete from records where kind='politician' and id=$1",[id]);db.release();await p.end()
 }
})
test('plano limitado é dry-run, exige hash e não reinicia falha histórica',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const p=pool(),db=await p.connect(),owner=String(randomInt(100000000,999999999))
 try{
  await db.query('begin');await db.query('select pg_advisory_xact_lock(6211501)')
  const old:Task={kind:'expense',owner,year:2025};await enqueue(db,old)
  await db.query("update collection_jobs set page=2,status='failed' where key=$1",[jobKey(old)])
  const options={earliest:2023,limit:2,maxPending:10000,databaseLimitBytes:500000000,kinds:['vote' as const],now}
  const before=(await db.query('select count(*)::int n from collection_jobs')).rows[0].n
  const plan=await backfillPlan(db,options)
  assert.equal((await db.query('select count(*)::int n from collection_jobs')).rows[0].n,before)
  assert.equal(plan.tasks.length,2);assert.ok(plan.tasks.every(t=>t.year===2026))
  await assert.rejects(seedBackfill(db,options,'0'.repeat(64)),/Plano mudou/)
  await seedBackfill(db,options,plan.sha256)
  assert.equal((await db.query('select page from collection_jobs where key=$1',[jobKey(old)])).rows[0].page,2)
  assert.ok((await backfillPlan(db,options)).missingScopes<plan.missingScopes)
 }finally{await db.query('rollback');db.release();await p.end()}
})
test('prioridade anual persiste e reserva quinta oportunidade para sincronização',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const p=pool(),db=await p.connect(),owner=String(randomInt(100000000,999999999)),keys:string[]=[]
 try{
  await db.query('select pg_advisory_lock(6211501)')
  const years=[2026,2025,2023,2024,2022]
  for(const year of years){const task:Task={kind:'proposal',owner,year};await enqueue(db,task);keys.push(jobKey(task))}
  const refresh:Task={kind:'proposal',owner,year:2026,name:'refresh-test'};await enqueue(db,refresh);keys.push(jobKey(refresh))
  await db.query("update collection_jobs set status='done' where key=$1",[jobKey(refresh)])
  await db.query("update collection_kind_state set served=0 where kind='proposal'")
  const calls:string[]=[]
  const fetcher=async(t:Task,page:number)=>{calls.push(t.name??String(t.year));return {page,url:collectionUrl(t,page).href,raw:Buffer.from('{"dados":[],"links":[]}')}}
  const config={kinds:['proposal' as const],year:2026,years,owner,maxTasks:3,maxSeconds:10,maxRequests:10,maxBytes:100000,databaseLimitBytes:500000000,maxPending:10000}
  await generalBatch(db,config,fetcher);await generalBatch(db,{...config,maxTasks:2},fetcher)
  assert.deepEqual(calls,['2026','2025','2023','2024','refresh-test'])
 }finally{
  await db.query('update collection_jobs set cycle_id=null where key=any($1)',[keys])
  for(const table of ['collection_observations','collection_absences','collection_receipts'])await db.query(`delete from ${table} where cycle_id in(select id from collection_cycles where job_key=any($1))`,[keys])
  await db.query('delete from collection_cycles where job_key=any($1)',[keys]);await db.query('delete from collection_jobs where key=any($1)',[keys])
  await db.query('select pg_advisory_unlock(6211501)');db.release();await p.end()
 }
})
test('cobertura HTTP preserva desconhecido, datas separadas e valida filtros',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const p=pool(),api=await app(p)
 try{
  const response=await api.inject('/api/coverage?kind=expense&year=2026&owner=999999998&by=period')
  assert.equal(response.statusCode,200,response.body)
  const result=response.json();assert.equal(result.institutionalTotal,null);assert.equal(result.coveragePercent,null)
  assert.equal(result.totals.published,0);assert.match(result.interpretation,/não comprova/)
  assert.equal((await api.inject('/api/coverage?by=invalid')).statusCode,400)
  assert.equal((await api.inject('/api/coverage?owner=1%20OR%201=1')).statusCode,400)
 }finally{await api.close();await p.end()}
})
test('cobertura HTTP usa competência para período e mantém emissão/coleta/verificação distintas',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const p=pool(),db=await p.connect(),owner=String(randomInt(100000000,999999999)),task:Task={kind:'expense',owner,year:2026},key=jobKey(task)
 const raw=Buffer.from(JSON.stringify({dados:[{codDocumento:'7',tipoDespesa:'Categoria teste',ano:2026,mes:2,dataDocumento:'2026-03-04',valorLiquido:1}],links:[]}))
 let cycle:string|undefined
 const api=await app(p)
 try{
  await enqueue(db,task)
  cycle=(await db.query("insert into collection_cycles(job_key,scope_from,scope_to) values($1,'2026-01-01','2026-11-26') returning id",[key])).rows[0].id
  await persist(db,key,task,parsePage(raw,task,1,collectionUrl(task).href),undefined,cycle)
  const response=await api.inject(`/api/coverage?kind=expense&year=2026&owner=${owner}&by=period`)
  assert.equal(response.statusCode,200,response.body)
  const c=response.json();assert.equal(c.groups[0].dimension,'02');assert.equal(c.groups[0].first_event,'2026-03-04')
  assert.ok(c.groups[0].last_collected);assert.ok(c.groups[0].last_verified)
  assert.equal(c.scopes[0].state,'complete_as_of_collection');assert.equal(c.scopes[0].current_validated_rows,'1')
  assert.equal(c.institutionalTotal,null)
 }finally{
  if(cycle){for(const table of ['collection_observations','collection_absences','collection_receipts'])await db.query(`delete from ${table} where cycle_id=$1`,[cycle]);await db.query('delete from collection_cycles where id=$1',[cycle])}
  await db.query("delete from records where kind='expense' and owner=$1",[owner]);await db.query('delete from collection_jobs where key=$1',[key])
  await api.close();db.release();await p.end()
 }
})
