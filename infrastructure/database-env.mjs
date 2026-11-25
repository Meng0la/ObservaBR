if (!process.env.DATABASE_URL) {
  const uri = new URL('postgresql://db:5432/observabr')
  uri.username = encodeURIComponent(process.env.PGUSER)
  uri.password = encodeURIComponent(process.env.PGPASSWORD)
  process.env.DATABASE_URL = uri.href
}
