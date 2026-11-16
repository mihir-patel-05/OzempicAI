import { Hono } from 'hono'
import type { AppEnv } from '../auth.js'
import { withUser } from '../db.js'
import { limitParam, requireUuid } from '../http.js'
import { listActivity, undoActivity } from '../mcp/activity.js'

/**
 * Plans → AI activity: what connected AI apps changed, with Undo. Session
 * routes for the web app; AI apps can't reach them with their tokens.
 * Available even when MCP_ENABLED is off, so changes can still be undone.
 */
export const activityRoutes = new Hono<AppEnv>()

activityRoutes.get('/agent-activity', async (c) => {
  const userId = c.get('user').id
  const limit = limitParam(c.req.query('limit'), 20, 50)
  return c.json(await withUser(userId, (db) => listActivity(db, userId, limit)))
})

activityRoutes.post('/agent-activity/:id/undo', async (c) => {
  const userId = c.get('user').id
  const id = requireUuid(c.req.param('id'))
  return c.json(await withUser(userId, (db) => undoActivity(db, userId, id)))
})
