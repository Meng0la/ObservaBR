import pg from 'pg'
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória')
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
