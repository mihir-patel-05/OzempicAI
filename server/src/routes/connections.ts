import { Hono } from 'hono'
import type { AppEnv } from '../auth.js'
import { pool, withTransaction } from '../db.js'
import { HttpError, requireUuid } from '../http.js'
import { revokeGrant } from '../oauth/tokens.js'

/**
 * AI apps the signed-in user has connected over OAuth (Profile → Connected
 * AI apps). The grants live in the auth schema, which only the API's owner
 * role can read, so every query filters by the caller's id. Available even
 * when MCP_ENABLED is off, so a connection can always be removed.
 */
export const connectionRoutes = new Hono<AppEnv>()

connectionRoutes.get('/connections', async (c) => {
  const { rows } = await pool.query(
    `select g.id, c.client_name, g.scopes, g.created_at, g.last_used_at
       from auth.oauth_grants g
       join auth.oauth_clients c on c.client_id = g.client_id
      where g.user_id = $1 and g.revoked_at is null and g.expires_at > now()
      order by g.created_at desc`,
    [c.get('user').id],
  )
  return c.json(rows)
})

connectionRoutes.delete('/connections/:id', async (c) => {
  const id = requireUuid(c.req.param('id'))
  const { rows } = await pool.query(
    'select id from auth.oauth_grants where id = $1 and user_id = $2 and revoked_at is null',
    [id, c.get('user').id],
  )
  if (!rows[0]) throw new HttpError(404, 'Connection not found')
  await withTransaction((db) => revokeGrant(db, id))
  return c.body(null, 204)
})
