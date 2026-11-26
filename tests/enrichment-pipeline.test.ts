import test from 'node:test'
import assert from 'node:assert/strict'
import {randomInt,createHash} from 'node:crypto'
import pg from 'pg'
import {processEnrichment} from '../packages/scout/enrichment.ts'
import {resourceUrl,type Resource} from '../packages/collectors/camara/enrichment.ts'
import {app} from '../apps/api/app.ts'
import {persist} from '../packages/scout/store.ts'
import {parsePage} from '../packages/collectors/camara/index.ts'
test('enriquecimento usa cache, deduplica e aplica privacidade e RLS',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path=observabr,public,extensions'})
 const db=await pool.connect()
 const voteId=String(randomInt(80000000,90000000))+'-8'
 const proposalId=String(randomInt(80000000,90000000))
 const deputyId=String(randomInt(80000000,90000000))
 const raw=Buffer.from('{}')
 const sha=createHash('sha256').update(raw).digest('hex')
 let calls=0
 async function fetcher(resource:Resource,id:string){
  calls++
  let data:unknown=[]
  if(resource==='vote')data={id,data:'2025-12-16',siglaOrgao:'PLEN',descricao:'Mantido o texto. Sim: 1; Não: 0; Total: 1.',
   descUltimaAberturaVotacao:'Votação do PLP 9/2025',proposicoesAfetadas:[{id:proposalId,siglaTipo:'PLP',numero:9,ano:2025}],objetosPossiveis:[]}
  if(resource==='votes')data=[{tipoVoto:'Sim',deputado_:{id:deputyId,nome:'Fixture isolada',siglaPartido:'TESTE',siglaUf:'DF',email:'remover@teste.invalid'},dataRegistroVoto:'2025-12-16T12:00:00'}]
  if(resource==='proposal')data={id,siglaTipo:'PLP',numero:9,ano:2025,ementa:'Somente teste isolado'}
  const payload={dados:data,links:[]}
  return {resource,id,url:resourceUrl(resource,id).href,payload,raw:Buffer.from(JSON.stringify(payload))}
 }
 const api=await app(pool)
 try{
  await db.query('insert into source_documents(sha256,raw) values($1,$2) on conflict do nothing',[sha,raw])
  await db.query("insert into records(kind,id,title,data,source_url,api_url,field,sha256,search_text) values('vote',$1,'Fixture',$2,$3,$3,'/dados',$4,'fixture')",[voteId,{},resourceUrl('vote',voteId).href,sha])
  await db.query("insert into enrichment_jobs(kind,external_id) values('vote',$1)",[voteId])
  await processEnrichment(db,'vote',voteId,fetcher)
  const firstCalls=calls
  await processEnrichment(db,'vote',voteId,fetcher)
  assert.equal(calls,firstCalls)
  const listing=Buffer.from(JSON.stringify({dados:[{id:voteId,data:'2025-12-16',descricao:'Somente o placar da listagem'}],links:[]}))
  await persist(db,'fixture-listing',{kind:'vote',year:2025,month:12},parsePage(listing,{kind:'vote',year:2025},1,'https://dadosabertos.camara.leg.br/api/v2/votacoes?pagina=1'))
  assert.match((await db.query("select title from records where kind='vote' and id=$1",[voteId])).rows[0].title,/PLP 9/)
  const response=await api.inject('/api/votes/'+voteId)
  assert.equal(response.statusCode,200)
  assert.equal(response.json().nominalTotal,1)
  assert.equal(response.json().context.mainProposal.id,proposalId)
  const evidence=(await api.inject('/api/evidence/vote/'+voteId)).json()
  assert.ok(evidence.documents.length>=4)
  assert.ok(!JSON.stringify(evidence).includes('remover@'))
  assert.ok(evidence.documents.some((d:{original:boolean})=>!d.original))
  const ballots=(await api.inject('/api/records?kind=ballot&voteId='+voteId+'&party=TESTE&vote=Sim')).json()
  assert.equal(ballots.total,1)
  assert.equal(ballots.items[0].data.uf,'DF')
  assert.equal((await api.inject({method:'POST',url:'/api/enrichment',payload:{kind:'vote',id:'https://127.0.0.1/'}})).statusCode,404)
  assert.equal((await api.inject({method:'POST',url:'/api/enrichment',payload:{kind:'vote',id:voteId,url:'https://127.0.0.1/'}})).statusCode,400)
  await db.query('set role observabr_reader')
  assert.ok((await db.query('select payload from api_snapshots limit 1')).rowCount)
  await assert.rejects(db.query('select raw from source_documents limit 1'),{code:'42501'})
 }finally{await db.query('reset role');await api.close();db.release();await pool.end()}
})
