import pg from 'pg'

// Match what PostgREST used to hand the client: numbers as numbers and
// calendar dates as plain YYYY-MM-DD strings (never shifted into a timezone).
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value))
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value))
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value)

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

export const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
})

pool.on('error', (err) => {
  console.error('Idle database client error', err)
})

export type Db = pg.PoolClient

/** Run `fn` in a transaction as the database owner (no row level security). */
export async function withTransaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (err) {
    await client.query('rollback').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/**
 * Run `fn` in a transaction as the `authenticated` role with auth.uid() set to
 * `userId`, so every row level security policy applies exactly as it did on
 * Supabase. All user-facing data access goes through here.
 */
export async function withUser<T>(userId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  return withTransaction(async (db) => {
    await db.query('set local role authenticated')
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId])
    return fn(db)
  })
}
