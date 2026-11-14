/**
 * One-off copy of the hosted Supabase data into the Railway database.
 *
 *   SOURCE_DATABASE_URL=<Supabase connection string> \
 *   DATABASE_URL=<Railway Postgres public URL> \
 *   node dist/import-supabase.js [--dry-run]
 *
 * - Run `node dist/migrate.js` against the target first (the deploy does this).
 * - Accounts keep their ids and bcrypt password hashes, so everyone signs in
 *   with the password they already have.
 * - Only columns present on both sides are copied (the hosted schema drifted
 *   from the migration files), and existing ids are skipped, so it is safe to
 *   rerun. Everything is written in one transaction.
 */
import pg from 'pg'

const TABLES = [
  'users',
  'calorie_logs',
  'water_logs',
  'exercise_logs',
  'heart_rate_logs',
  'weight_logs',
  'meal_plans',
  'grocery_items',
  'day_labels',
  'workout_plans',
  'workout_plan_exercises',
  'workout_sessions',
  'workout_session_exercises',
] as const

const dryRun = process.argv.includes('--dry-run')

function client(url: string | undefined, name: string): pg.Client {
  if (!url) throw new Error(`${name} is not set`)
  const internal = url.includes('.railway.internal') || url.includes('localhost')
  return new pg.Client({
    connectionString: url,
    ssl: internal ? undefined : { rejectUnauthorized: false },
  })
}

async function columns(db: pg.Client, schema: string, table: string): Promise<string[]> {
  const { rows } = await db.query<{ column_name: string }>(
    `select column_name from information_schema.columns
      where table_schema = $1 and table_name = $2 order by ordinal_position`,
    [schema, table],
  )
  return rows.map((r) => r.column_name)
}

/** Copy rows as JSON so every type round-trips through Postgres itself. */
async function copy(
  source: pg.Client,
  target: pg.Client,
  schema: string,
  table: string,
  onConflict: string,
  only?: string[],
  /** Per-column SQL expression to read from the source instead of the column. */
  exprs: Record<string, string> = {},
): Promise<string> {
  const sourceCols = await columns(source, schema, table)
  if (sourceCols.length === 0) return `${schema}.${table}: not in source, skipped`
  const targetCols = await columns(target, schema, table)
  const shared = targetCols.filter((c) => sourceCols.includes(c) && (!only || only.includes(c)))
  const list = shared.map((c) => `"${c}"`).join(', ')
  const selectList = shared.map((c) => (exprs[c] ? `${exprs[c]} as "${c}"` : `"${c}"`)).join(', ')

  const { rows } = await source.query<{ data: unknown[] }>(
    `select coalesce(json_agg(t), '[]'::json) as data
       from (select ${selectList} from ${schema}."${table}") t`,
  )
  const data = rows[0]!.data
  const result = await target.query(
    `insert into ${schema}."${table}" (${list})
     select ${list} from json_populate_recordset(null::${schema}."${table}", $1::json)
     ${onConflict}`,
    [JSON.stringify(data)],
  )
  return `${schema}.${table}: ${data.length} in source, ${result.rowCount} inserted/updated`
}

async function main() {
  const source = client(process.env.SOURCE_DATABASE_URL, 'SOURCE_DATABASE_URL')
  const target = client(process.env.DATABASE_URL, 'DATABASE_URL')
  await source.connect()
  await target.connect()

  try {
    // The Swift-era public.workout_plans has a different shape (one row per
    // exercise). Only copy plans if the source has the current model.
    const planCols = await columns(source, 'public', 'workout_plans')
    const legacyPlans = planCols.length > 0 && !planCols.includes('workout_type')

    await target.query('begin')
    const report: string[] = []

    // Accounts without a password (e.g. OAuth-only) get an unusable hash '!';
    // they can still get in through "Forgot password".
    report.push(
      await copy(
        source,
        target,
        'auth',
        'users',
        `on conflict (id) do nothing`,
        ['id', 'email', 'encrypted_password', 'raw_user_meta_data', 'created_at', 'updated_at'],
        {
          email: `coalesce(email, '')`,
          encrypted_password: `coalesce(nullif(encrypted_password, ''), '!')`,
          raw_user_meta_data: `coalesce(raw_user_meta_data, '{}'::jsonb)`,
        },
      ),
    )

    for (const table of TABLES) {
      if (legacyPlans && (table === 'workout_plans' || table === 'workout_plan_exercises')) {
        report.push(`public.${table}: source has the legacy Swift shape, skipped`)
        continue
      }
      if (table === 'users') {
        // The signup trigger already made default profiles; overwrite them
        // with the real ones.
        const cols = (await columns(source, 'public', 'users')).filter((c) => c !== 'id')
        const targetCols = await columns(target, 'public', 'users')
        const updates = cols
          .filter((c) => targetCols.includes(c))
          .map((c) => `"${c}" = excluded."${c}"`)
          .join(', ')
        report.push(
          await copy(source, target, 'public', 'users', `on conflict (id) do update set ${updates}`),
        )
        continue
      }
      report.push(await copy(source, target, 'public', table, 'on conflict (id) do nothing'))
    }

    if (dryRun) {
      await target.query('rollback')
      report.push('Dry run: rolled back, nothing written.')
    } else {
      await target.query('commit')
    }
    console.log(report.join('\n'))
  } catch (err) {
    await target.query('rollback').catch(() => {})
    throw err
  } finally {
    await source.end()
    await target.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
