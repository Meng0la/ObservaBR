import {database,transaction} from '../packages/database/index.ts'
import {parsePage} from '../packages/collectors/camara/index.ts'
import {createHash} from 'node:crypto'
const pool=database()
const db=await pool.connect()
try{
 const acquired=(await db.query('select pg_try_advisory_lock(6211501) as acquired')).rows[0].acquired
 if(!acquired)throw Error('Aguarde o Scout liberar a coleta')
 const groups=await db.query("select distinct sha256,api_url from records where kind='vote' order by sha256,api_url")
 let updated=0
 for(const group of groups.rows){
  const url=new URL(group.api_url)
  if(url.pathname!=='/api/v2/votacoes')continue
  const raw=(await db.query('select raw from source_documents where sha256=$1',[group.sha256])).rows[0].raw
  if(createHash('sha256').update(raw).digest('hex')!==group.sha256)throw Error('Integridade da evidência arquivada inválida')
  const year=Number(url.searchParams.get('dataInicio')?.slice(0,4))
  if(!Number.isInteger(year)||year<1900)throw Error('Período da página ausente')
  const page=parsePage(raw,{kind:'vote',year},Number(url.searchParams.get('pagina')||1),url.href)
  await transaction(db,async()=>{
   for(const record of page.records){
    const fields={eventUrl:record.data.eventUrl,bodyUrl:record.data.bodyUrl,registered:record.data.registered}
    const result=await db.query(`update records r set data=r.data||$2::jsonb where kind='vote' and id=$1 and sha256=$3
     and not exists(select 1 from entity_contexts c where c.kind=r.kind and c.external_id=r.id)
     and r.data is distinct from r.data||$2::jsonb`,[record.id,JSON.stringify(fields),group.sha256])
    updated+=result.rowCount??0
   }
  })
 }
 console.log(JSON.stringify({updated}))
}finally{db.release(true);await pool.end()}
