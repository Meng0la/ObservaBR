import {database,transaction} from '../packages/database/index.ts'
import {saveSnapshot} from '../packages/scout/evidence.ts'
import {createHash} from 'node:crypto'
const pool=database()
const db=await pool.connect()
try{
 const groups=await db.query('select distinct sha256,api_url from records order by api_url,sha256')
 let count=0
 for(const row of groups.rows){
  await transaction(db,async()=>{
   const archived=(await db.query('select raw,collected_at from source_documents where sha256=$1',[row.sha256])).rows[0]
   const raw=archived.raw
   if(createHash('sha256').update(raw).digest('hex')!==row.sha256)throw Error('Integridade da evidência arquivada inválida')
   const verification=(await db.query('select max(verified_at) as verified from records where sha256=$1',[row.sha256])).rows[0]
   await saveSnapshot(db,{resource:'indexed-page',id:row.sha256,url:row.api_url,raw,payload:JSON.parse(raw.toString('utf8')),collectedAt:archived.collected_at,verifiedAt:verification.verified})
  })
  count++
 }
 console.log(JSON.stringify({projectedPages:count}))
}finally{db.release();await pool.end()}
