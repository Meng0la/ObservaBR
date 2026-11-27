import {test} from 'node:test'
import assert from 'node:assert/strict'
import type pg from 'pg'
import {app} from '../apps/api/app.ts'
import {validateDatabaseTls} from '../packages/database/index.ts'

test('banco remoto exige verify-full e CA; conexões locais permanecem compatíveis',()=>{
 assert.equal(validateDatabaseTls('postgresql://user:pass@127.0.0.1:5432/db').hostname,'127.0.0.1')
 assert.equal(validateDatabaseTls('postgresql://user:pass@db:5432/db').hostname,'db')
 assert.throws(()=>validateDatabaseTls('postgresql://user:pass@remote.example/db'),/verify-full/)
 assert.throws(()=>validateDatabaseTls('postgresql://user:pass@remote.example/db?sslmode=require'),/verify-full/)
 assert.throws(()=>validateDatabaseTls('postgresql://user:pass@remote.example/db?sslmode=verify-full',{}),/CA confiável/)
 assert.equal(validateDatabaseTls('postgresql://user:pass@remote.example/db?sslmode=verify-full',{NODE_EXTRA_CA_CERTS:'/ca.pem'}).hostname,'remote.example')
 assert.equal(validateDatabaseTls('postgresql://user:pass@remote.example/db?sslmode=verify-full&sslrootcert=%2Fca.pem',{}).hostname,'remote.example')
})

function fakePool(delay=0){
 let connects=0
 const commands:string[]=[]
 const client={
  async query(sql:string){
   commands.push(sql)
   if(delay&&sql.startsWith('with base'))await new Promise(resolve=>setTimeout(resolve,delay))
   if(sql.includes('select count(*)::int n from ('))return {rows:[{n:0}],rowCount:1}
   if(sql.includes('select count(*)::int n from collection_jobs'))return {rows:[{n:0}],rowCount:1}
   if(sql.startsWith('with base')&&sql.includes('select count(*)::int published'))return {rows:[{published:0}],rowCount:1}
   return {rows:[],rowCount:0}
  },
  release(){}
 }
 return {pool:{async connect(){connects++;return client}} as unknown as pg.Pool,commands,get connects(){return connects}}
}

test('cobertura limita taxa, cache, timeout e concorrência',async()=>{
 const cached=fakePool(),cachedApi=await app(cached.pool)
 try{
  const first=await cachedApi.inject('/api/coverage?kind=expense&year=2026&by=period')
  const second=await cachedApi.inject('/api/coverage?kind=expense&year=2026&by=period')
  assert.equal(first.statusCode,200);assert.equal(second.statusCode,200)
  assert.equal(cached.connects,1)
  assert.ok(cached.commands.includes("set local statement_timeout='5s'"))
  assert.equal(second.headers['cache-control'],'public, max-age=30')
 }finally{await cachedApi.close()}

 const concurrent=fakePool(100),concurrentApi=await app(concurrent.pool)
 try{
  const responses=await Promise.all([
   concurrentApi.inject('/api/coverage?kind=expense&year=2026&by=period&page=1'),
   concurrentApi.inject('/api/coverage?kind=expense&year=2026&by=period&page=2'),
   concurrentApi.inject('/api/coverage?kind=expense&year=2026&by=period&page=3')])
  assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,200,503])
  assert.equal(concurrent.connects,2)
 }finally{await concurrentApi.close()}

 const limited=fakePool(),limitedApi=await app(limited.pool)
 try{
  const responses=[]
  for(let i=0;i<13;i++)responses.push(await limitedApi.inject('/api/coverage?kind=expense&year=2026&by=period'))
  assert.equal(responses.at(-1)?.statusCode,429)
 }finally{await limitedApi.close()}
})
