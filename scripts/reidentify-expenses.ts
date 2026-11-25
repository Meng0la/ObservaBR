import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { database, transaction } from '../packages/database/index.ts'
import { parsePage } from '../packages/collectors/camara/index.ts'

// One-time upgrade for the first development builds. All identifiers are
// recalculated against the archived page referenced by each published record.
const pool = database()
const db = await pool.connect()
try {
  await transaction(db, async () => {
    const lock = await db.query('select pg_try_advisory_xact_lock(6211501) as acquired')
    assert.ok(lock.rows[0].acquired, 'Aguarde o encerramento do Scout')
    const snapshots = await db.query(`select distinct r.sha256,r.owner,r.api_url
      from records r where r.kind='expense' order by r.sha256,r.owner,r.api_url`)
    let changed = 0
    for (const source of snapshots.rows) {
      const document = await db.query('select raw from source_documents where sha256=$1', [source.sha256])
      const raw = document.rows[0].raw
      assert.equal(createHash('sha256').update(raw).digest('hex'), source.sha256)
      const url = new URL(source.api_url)
      const task = { kind: 'expense' as const, owner: source.owner, year: Number(url.searchParams.get('ano')) }
      const page = parsePage(raw, task, Number(url.searchParams.get('pagina') ?? '1'), url.href)
      const records = await db.query(`select id,field,title,amount,source_url from records
        where kind='expense' and sha256=$1 and owner=$2 and api_url=$3 for update`,
      [source.sha256, source.owner, source.api_url])
      for (const old of records.rows) {
        const next = page.records.find(candidate => candidate.field === old.field)
        assert.ok(next, 'Campo não encontrado na evidência')
        assert.equal(next.title, old.title)
        assert.equal(next.sourceUrl, old.source_url)
        const amount = await db.query('select $1::numeric is not distinct from $2::numeric as same', [next.amount, old.amount])
        assert.ok(amount.rows[0].same, 'Valor divergente da evidência')
        if (next.id === old.id) continue
        await db.query(`update records set id=$2,search_text=replace(search_text,$1,$2)
          where kind='expense' and id=$1`, [old.id, next.id])
        // Historical JSON remains the exact snapshot from the old version.
        await db.query("update data_revisions set id=$2 where kind='expense' and id=$1", [old.id, next.id])
        changed++
      }
    }
    console.log(JSON.stringify({ evidenceGroups: snapshots.rowCount, changed }))
  })
} finally {
  db.release()
  await pool.end()
}
