import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import pg from 'pg'

function worker(env:NodeJS.ProcessEnv) {
  return new Promise<{code:number|null;output:string}>((resolve,reject)=>{
    const child=spawn(process.execPath,['apps/worker/index.ts','--enrichment-batch'],{
      env:{...process.env,...env},timeout:12_000,windowsHide:true
    })
    let output=''
    child.stdout.on('data',chunk=>{output+=chunk})
    child.stderr.on('data',chunk=>{output+=chunk})
    child.on('error',reject)
    child.on('close',code=>resolve({code,output}))
  })
}
test('Scout em lote rejeita limites inválidos antes de conectar',async()=>{
  const result=await worker({DATABASE_URL:'postgresql://invalid@127.0.0.1:1/invalid',SCOUT_MAX_JOBS:'0'})
  assert.notEqual(result.code,0)
  assert.match(result.output,/Limites inválidos/)
})
test('Scout em lote respeita o lock e termina sem iniciar coleta geral', {skip:!process.env.TEST_DATABASE_URL},async()=>{
  const db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL})
  const key='batch-test-'+randomUUID()
  await db.connect()
  try {
    await db.query('select pg_advisory_lock(6211501)')
    const locked=await worker({DATABASE_URL:process.env.TEST_DATABASE_URL,SCOUT_MAX_JOBS:'1'})
    assert.notEqual(locked.code,0)
    assert.match(locked.output,/Outro Scout/)
    await db.query('select pg_advisory_unlock(6211501)')
    await db.query(`insert into observabr.collection_jobs(key,kind,task,status,due_at)
      values($1,'politician','{"kind":"politician","year":2025}','running',now()+interval '1 year')`,[key])
    const empty=await worker({DATABASE_URL:process.env.TEST_DATABASE_URL,SCOUT_MAX_JOBS:'1'})
    assert.equal(empty.code,0,empty.output)
    const after=await db.query('select status from observabr.collection_jobs where key=$1',[key])
    assert.equal(after.rows[0].status,'running')
  } finally {
    await db.query('delete from observabr.collection_jobs where key=$1',[key])
    await db.end()
  }
})
