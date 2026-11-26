import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import type pg from 'pg'
import {parsePage} from '../collectors/camara/index.ts'
import {publicResponse} from '../security/public-response.ts'

type Change={oldId:string;newId:string;sha256:string;field:string;fingerprint:string}
export function decimalEqual(a:unknown,b:unknown){
 if(a==null||b==null)return a==null&&b==null
 const cents=(v:unknown)=>{
  const match=/^(-?)(\d{1,18})(?:\.(\d{1,2}))?$/.exec(String(v))
  assert.ok(match,'Representação decimal inválida')
  return (match[1]? -1n:1n)*(BigInt(match[2])*100n+BigInt((match[3]||'').padEnd(2,'0')))
 }
 return cents(a)===cents(b)
}
export async function expensePlan(db:pg.PoolClient,owner:string,year:number) {
 const result=await db.query(`select r.*,md5(to_jsonb(r)::text) as fingerprint from records r
  where kind='expense' and owner=$1 and data->>'year'=$2 order by id`,[owner,String(year)])
 const changes:Change[]=[]
 const pages=new Map<string,ReturnType<typeof parsePage>>()
 for(const old of result.rows){
  const url=new URL(old.api_url)
  assert.equal(url.hostname,'dadosabertos.camara.leg.br')
  assert.equal(url.pathname,`/api/v2/deputados/${owner}/despesas`)
  const pageKey=old.sha256+'\n'+old.api_url
  if(!pages.has(pageKey)){
   const source=await db.query('select raw from source_documents where sha256=$1',[old.sha256])
   const raw=source.rows[0]?.raw
   assert.ok(Buffer.isBuffer(raw)&&raw.length<=6*1024*1024,'Evidência ausente ou acima do limite')
   assert.equal(createHash('sha256').update(raw).digest('hex'),old.sha256,'Hash da evidência inválido')
   pages.set(pageKey,parsePage(raw,{kind:'expense',owner,year},Number(url.searchParams.get('pagina')||1),old.api_url))
  }
  const page=pages.get(pageKey)!
  const next=page.records.find(r=>r.field===old.field)
  assert.ok(next,'Ponteiro de evidência ausente')
  const publication=publicResponse({title:next.title,data:next.data}).payload as {title:string,data:Record<string,unknown>}
  assert.ok(publication.title===old.title,'Título divergente da projeção publicável')
  assert.ok(next.date===(old.date?.toISOString().slice(0,10)??null),'Data divergente da evidência')
  assert.ok(next.sourceUrl===old.source_url,'URL documental divergente da evidência')
  for(const key of ['month','documentId','cnpj','supplier','category','year'])assert.ok(publication.data[key]===old.data[key],'Divergência na projeção do campo '+key)
  for(const key of ['net','gross','withheld']){
   assert.ok(decimalEqual(publication.data[key],old.data[key]),'Componente financeiro divergente')
  }
  assert.ok(decimalEqual(old.amount,next.amount),'Valor divergente')
  if(old.id!==next.id)changes.push({oldId:old.id,newId:next.id,sha256:old.sha256,field:old.field,fingerprint:old.fingerprint})
 }
 assert.equal(new Set(changes.map(c=>c.newId)).size,changes.length,'Conciliação ambígua; preservar registros para revisão')
 for(const change of changes){
  const collision=await db.query("select id from records where kind='expense' and id=$1",[change.newId])
  assert.equal(collision.rowCount,0,'Destino já ocupado; requer revisão sem excluir registros')
 }
 const plan={version:1,owner,year,examined:result.rowCount,changes}
 return {...plan,sha256:createHash('sha256').update(JSON.stringify(plan)).digest('hex')}
}
export async function applyExpensePlan(db:pg.PoolClient,plan:Awaited<ReturnType<typeof expensePlan>>,expected:string){
 assert.equal(plan.sha256,expected,'Plano alterado; execute novamente o dry-run')
 const {sha256,...content}=plan
 assert.equal(createHash('sha256').update(JSON.stringify(content)).digest('hex'),sha256,'Plano alterado; execute novamente o dry-run')
 for(const c of plan.changes){
  const row=await db.query("select to_jsonb(r) as previous,md5(to_jsonb(r)::text) as fingerprint from records r where kind='expense' and id=$1 for update",[c.oldId])
  assert.equal(row.rows[0]?.fingerprint,c.fingerprint,'Registro mudou desde o plano')
  await db.query("update records set id=$2,search_text=replace(search_text,$1,$2) where kind='expense' and id=$1",[c.oldId,c.newId])
  await db.query("insert into record_aliases(kind,alias_id,record_id,sha256,field,plan_sha256) values('expense',$1,$2,$3,$4,$5)",[c.oldId,c.newId,c.sha256,c.field,expected])
  await db.query("insert into data_revisions(kind,id,previous) values('expense',$1,$2)",[c.newId,row.rows[0].previous])
 }
 return plan.changes.length
}
