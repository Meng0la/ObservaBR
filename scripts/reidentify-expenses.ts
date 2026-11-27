import assert from 'node:assert/strict'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {database,transaction} from '../packages/database/index.ts'
import {expensePlan,applyExpensePlan} from '../packages/scout/expense-reconciliation.ts'
const args=process.argv.slice(2)
const option=(key:string)=>args.find(a=>a.startsWith(key+'='))?.slice(key.length+1)
const owner=option('--owner')||'204379',year=Number(option('--year')||2025)
assert.match(owner,/^[1-9]\d{0,13}$/)
assert.ok(Number.isInteger(year)&&year>=2008&&year<=new Date().getUTCFullYear())
const apply=args.includes('--apply'),expected=option('--expected-plan')
if(apply){
 assert.match(expected||'',/^[a-f0-9]{64}$/,'Aplicação exige --expected-plan do dry-run')
 const host=new URL(process.env.DATABASE_URL||'').hostname
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(host)||args.includes('--allow-remote'),'Aplicação remota exige autorização operacional e --allow-remote')
}
const pool=database(),db=await pool.connect()
try {
 await transaction(db,async()=>{
  await db.query("set local timezone='UTC'")
  assert.ok((await db.query('select pg_try_advisory_xact_lock(6211501) as locked')).rows[0].locked,'Scout ativo')
  const plan=await expensePlan(db,owner,year)
  await mkdir('.tools/data-engineering',{recursive:true})
  const output='.tools/data-engineering/expense-plan-'+plan.sha256+'.json'
  const serialized=JSON.stringify(plan,null,2)+'\n'
  try{await writeFile(output,serialized,{mode:0o600,flag:'wx'})}catch(error){
   if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error
   assert.equal(await readFile(output,'utf8'),serialized,'Arquivo do plano já existe com conteúdo divergente')
  }
  if(apply)await applyExpensePlan(db,plan,expected!)
  console.log(JSON.stringify({mode:apply?'applied':'dry-run',examined:plan.examined,changes:plan.changes.length,planSha256:plan.sha256,output}))
 })
} finally {db.release();await pool.end()}
