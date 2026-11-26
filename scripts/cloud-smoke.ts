import assert from 'node:assert/strict'
import type {TLSSocket} from 'node:tls'
import {database} from '../packages/database/index.ts'
import {app} from '../apps/api/app.ts'

// Read-only check from a cloud runner. Never emits a URL, password, row or raw body.
const pool=database()
const api=await app(pool)
try {
  const client=await pool.connect()
  try {
    const stream=(client as unknown as {connection:{stream:TLSSocket}}).connection.stream
    assert.equal(stream.encrypted,true)
    assert.equal(stream.authorized,true)
  } finally {client.release()}
  const session=await pool.query(`select current_user as role,
    has_table_privilege(current_user,'observabr.source_documents','select') as raw_access`)
  assert.equal(session.rows[0].role,'observabr_api')
  assert.equal(session.rows[0].raw_access,false)
  await assert.rejects(pool.query('select raw from source_documents limit 1'),{code:'42501'})
  for(const path of ['/api/health','/api/summary','/api/records?kind=politician&page=1',
    '/api/records?kind=politician&format=csv','/api/votes/2520670-66']) {
    const response=await api.inject({method:'GET',url:path})
    assert.equal(response.statusCode,200,path)
    if(path==='/api/summary')assert.ok(response.json().counts.politician>=513)
    if(path.includes('format=csv'))assert.match(response.body,/source_url,api_url,sha256/)
    console.log('OK '+path)
  }
  console.log('Conexão reader, TLS, RLS e contratos HTTP verificados na nuvem.')
} finally {await api.close();await pool.end()}
