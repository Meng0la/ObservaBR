import pg from 'pg'
const localDatabaseHosts=new Set(['localhost','127.0.0.1','[::1]','::1','db'])
export function validateDatabaseTls(value:string,environment:NodeJS.ProcessEnv=process.env) {
  const target=new URL(value)
  if(localDatabaseHosts.has(target.hostname))return target
  if(target.protocol!=='postgresql:'&&target.protocol!=='postgres:')throw Error('DATABASE_URL remota exige PostgreSQL')
  if(target.searchParams.get('sslmode')!=='verify-full')throw Error('DATABASE_URL remota exige sslmode=verify-full')
  if(!target.searchParams.get('sslrootcert')&&!environment.NODE_EXTRA_CA_CERTS)throw Error('DATABASE_URL remota exige CA confiável')
  return target
}
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória')
  validateDatabaseTls(process.env.DATABASE_URL)
  return new pg.Pool({connectionString:process.env.DATABASE_URL, max:6, connectionTimeoutMillis:8000,
    options:'-c search_path=observabr,public,extensions -c statement_timeout=30000'})
}
export async function transaction<T>(client:pg.PoolClient, run:()=>Promise<T>) {
  await client.query('begin')
  try {
    const value=await run()
    await client.query('commit')
    return value
  } catch(error) {
    await client.query('rollback')
    throw error
  }
}
