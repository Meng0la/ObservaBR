import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {readFile,readdir} from 'node:fs/promises'
import pg from 'pg'

test('migration classifica legado por histórico comprovado e mantém RLS/privilégio mínimo',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const target=new URL(process.env.TEST_DATABASE_URL!)
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(target.hostname),'Migration de ensaio exige PostgreSQL local')
 const name='observabr_cycle_migration_'+randomBytes(6).toString('hex')
 const adminUrl=new URL(target);adminUrl.pathname='/postgres'
 const admin=new pg.Client({connectionString:adminUrl.href});await admin.connect()
 let db:pg.Client|undefined,created=false
 try{
  await admin.query(`create database "${name}"`);created=true
  const url=new URL(target);url.pathname='/'+name
  db=new pg.Client({connectionString:url.href,options:'-c search_path=observabr,public,extensions'});await db.connect()
  const migration='20261127110000_persistent_cycle_mode.sql'
  for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&f<migration).sort())await db.query(await readFile('supabase/migrations/'+file,'utf8'))
  for(const key of ['known','ambiguous'])await db.query("insert into collection_jobs(key,kind,task,page) values($1,'proposal','{\"kind\":\"proposal\",\"year\":2025}',2)",[key])
  const first=(await db.query("insert into collection_cycles(job_key,started_at,completed_at,status) values('known',now()-interval '4 days',now()-interval '3 days','complete') returning id")).rows[0].id
  const known=(await db.query("insert into collection_cycles(job_key,started_at) values('known',now()-interval '2 days') returning id")).rows[0].id
  const ambiguous=(await db.query("insert into collection_cycles(job_key) values('ambiguous') returning id")).rows[0].id
  await db.query("update collection_jobs set cycle_id=$1 where key='known'",[known])
  await db.query("update collection_jobs set cycle_id=$1 where key='ambiguous'",[ambiguous])
  await db.query(await readFile('supabase/migrations/'+migration,'utf8'))
  const modes=(await db.query('select id,mode from collection_cycles')).rows
  assert.equal(modes.find(r=>r.id===first).mode,'backfill')
  assert.equal(modes.find(r=>r.id===known).mode,'refresh')
  assert.equal(modes.find(r=>r.id===ambiguous).mode,'backfill')
  await db.query('set role observabr_writer')
  await db.query('update collection_cycles set pages=pages+1 where id=$1',[known])
  await assert.rejects(db.query("update collection_cycles set mode='backfill' where id=$1",[known]),/imutáveis/)
  await db.query('reset role');await db.query('set role observabr_reader')
  assert.equal((await db.query('select mode from collection_cycles where id=$1',[known])).rows[0].mode,'refresh')
  await assert.rejects(db.query('select raw from source_documents'),/permission denied/)
  await db.query('reset role')
 }finally{
  if(db)await db.end()
  if(created)await admin.query(`drop database "${name}"`)
  await admin.end()
 }
})
