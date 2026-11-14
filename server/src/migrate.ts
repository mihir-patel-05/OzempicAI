/**
 * Apply server/migrations/*.sql in filename order, each in its own
 * transaction, recording what ran in platform.schema_migrations. Safe to run on
 * every deploy (Railway runs it as the pre-deploy command); an advisory lock
 * keeps two deploys from migrating at once.
 */
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { pool } from './db.js'

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url))
const LOCK_ID = 727_001

async function main() {
  const client = await pool.connect()
  try {
    await client.query('select pg_advisory_lock($1)', [LOCK_ID])
    await client.query('create schema if not exists platform')
    await client.query(`
      create table if not exists platform.schema_migrations (
        version    text primary key,
        applied_at timestamptz not null default now()
      )`)

    const { rows } = await client.query<{ version: string }>(
      'select version from platform.schema_migrations',
    )
    const applied = new Set(rows.map((row) => row.version))
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()

    let count = 0
    for (const file of files) {
      const version = file.replace(/\.sql$/, '')
      if (applied.has(version)) continue
      const sql = await readFile(MIGRATIONS_DIR + file, 'utf8')
      process.stdout.write(`Applying ${file} … `)
      try {
        await client.query('begin')
        await client.query(sql)
        await client.query('insert into platform.schema_migrations (version) values ($1)', [
          version,
        ])
        await client.query('commit')
      } catch (err) {
        await client.query('rollback')
        console.log('failed')
        throw err
      }
      console.log('done')
      count += 1
    }
    console.log(count ? `Applied ${count} migration(s).` : 'Database is up to date.')
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {})
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
