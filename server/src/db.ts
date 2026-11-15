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

/**
 * TLS to the database, from DATABASE_SSL:
 *   unset / false   no TLS (Railway's private network, local development)
 *   true / verify   TLS with the server certificate and hostname verified.
 *                   Put the provider's CA in DATABASE_CA_CERT (PEM text) if
 *                   it isn't a public one.
 *   no-verify       TLS without verification. Encrypts, but anyone who can
 *                   intercept the connection can impersonate the database;
 *                   only for a one-off against a host you can't verify.
 */
export function sslConfig(env: NodeJS.ProcessEnv = process.env): pg.PoolConfig['ssl'] {
  const mode = (env.DATABASE_SSL ?? '').trim().toLowerCase()
  if (mode === '' || mode === 'false') return undefined
  if (mode === 'no-verify') {
    console.warn('DATABASE_SSL=no-verify: the database certificate is NOT being verified.')
    return { rejectUnauthorized: false }
  }
  if (mode === 'true' || mode === 'verify') {
    const ca = env.DATABASE_CA_CERT?.replace(/\\n/g, '\n')
    return { rejectUnauthorized: true, ...(ca ? { ca } : {}) }
  }
  throw new Error(`DATABASE_SSL must be true, verify, no-verify or false (got "${env.DATABASE_SSL}")`)
}

function millis(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  // Fail fast instead of queueing forever when every connection is busy, and
  // never let one slow query or a stuck transaction hold a connection for
  // good. migrate.ts lifts the statement limit for its own session.
  connectionTimeoutMillis: millis(process.env.DATABASE_CONNECT_TIMEOUT_MS, 5_000),
  statement_timeout: millis(process.env.DATABASE_STATEMENT_TIMEOUT_MS, 15_000),
  idle_in_transaction_session_timeout: 30_000,
  ssl: sslConfig(),
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
