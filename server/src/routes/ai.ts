import Anthropic from '@anthropic-ai/sdk'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { AppEnv } from '../auth.js'
import { rateLimit } from '../auth.js'
import { withUser } from '../db.js'
import { HttpError, limitParam, readJson, requireUuid } from '../http.js'
import { AI_MAX_TURNS_PER_HOUR, isConfigured } from '../ai/client.js'
import { isValidTimezone, todayIn } from '../ai/dates.js'
import { renderForUi } from '../ai/history.js'
import { runTurn } from '../ai/loop.js'
import type { CoachEvent } from '../ai/loop.js'
import type { CoachProfile } from '../ai/prompt.js'
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  loadMessages,
} from '../ai/store.js'

export const MAX_MESSAGE_CHARS = 4000
const PING_MS = 15_000
const TITLE_CHARS = 60

/** Conversations with a turn in flight. One API replica, so memory is enough. */
const activeTurns = new Set<string>()

export const aiRoutes = new Hono<AppEnv>()

aiRoutes.use('/ai/*', async (_c, next) => {
  if (!isConfigured()) throw new HttpError(503, 'AI coach is not configured')
  await next()
})

/**
 * Send one message and stream the reply as server-sent events:
 *   conversation {conversation_id, title}   first, so a new chat learns its id
 *   text         {text}                     reply text deltas
 *   tool_start   {id, name}                 Claude started a tool call
 *   tool         {id, name, status, summary, created_ids, resource}
 *   error        {message}                  shown in the chat; the stream still ends with done
 *   ping         {}                         every 15 s so proxies keep the connection open
 *   done         {conversation_id}
 */
aiRoutes.post('/ai/chat', async (c) => {
  const user = c.get('user')
  const body = await readJson(c)

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) throw new HttpError(400, 'message is required')
  if (message.length > MAX_MESSAGE_CHARS) {
    throw new HttpError(400, `Messages can be at most ${MAX_MESSAGE_CHARS} characters`)
  }
  const tz = typeof body.timezone === 'string' && body.timezone ? body.timezone : 'UTC'
  if (!isValidTimezone(tz)) throw new HttpError(400, 'Invalid timezone')
  const requestedId =
    body.conversation_id === undefined || body.conversation_id === null
      ? null
      : requireUuid(typeof body.conversation_id === 'string' ? body.conversation_id : undefined, 'conversation_id')

  rateLimit(
    `ai:user:${user.id}`,
    AI_MAX_TURNS_PER_HOUR,
    60 * 60_000,
    "You've sent a lot of messages to your coach this hour. Please try again a bit later.",
  )

  if (requestedId && activeTurns.has(requestedId)) {
    throw new HttpError(409, 'Your coach is still replying in this chat')
  }

  const { conversationId, title, history, profile } = await withUser(user.id, async (db) => {
    const profileRows = await db.query<CoachProfile>(
      `select name, daily_calorie_goal, daily_water_goal_ml, weight_kg, height_cm, age, unit_system
         from public.users where id = $1`,
      [user.id],
    )
    if (requestedId) {
      const conversation = await getConversation(db, user.id, requestedId)
      if (!conversation) throw new HttpError(404, 'Conversation not found')
      return {
        conversationId: conversation.id,
        title: conversation.title,
        history: await loadMessages(db, user.id, conversation.id),
        profile: profileRows.rows[0] ?? null,
      }
    }
    const newTitle = message.replace(/\s+/g, ' ').slice(0, TITLE_CHARS)
    return {
      conversationId: await createConversation(db, user.id, newTitle),
      title: newTitle,
      history: [],
      profile: profileRows.rows[0] ?? null,
    }
  })

  if (activeTurns.has(conversationId)) throw new HttpError(409, 'Your coach is still replying in this chat')
  activeTurns.add(conversationId)

  return streamSSE(c, async (stream) => {
    const started = Date.now()
    // The turn keeps running if the browser goes away, so the reply and any
    // writes are saved and show up on reload. Writes to a closed stream fail
    // quietly.
    const send = (event: string, data: unknown) => {
      stream.writeSSE({ event, data: JSON.stringify(data) }).catch(() => {})
    }
    const emit = (event: CoachEvent) => {
      const { type, ...data } = event
      send(type, data)
    }
    const ping = setInterval(() => send('ping', {}), PING_MS)

    try {
      send('conversation', { conversation_id: conversationId, title })
      const stats = await runTurn(
        { userId: user.id, conversationId, history, message, tz, today: todayIn(tz), profile },
        emit,
      )
      console.log(
        JSON.stringify({ event: 'ai_turn', user_id: user.id, conversation_id: conversationId, ms: Date.now() - started, ...stats }),
      )
    } catch (err) {
      console.error('AI turn failed', err)
      emit({ type: 'error', message: friendlyError(err) })
    } finally {
      clearInterval(ping)
      activeTurns.delete(conversationId)
      send('done', { conversation_id: conversationId })
    }
  })
})

aiRoutes.get('/ai/conversations', async (c) => {
  const userId = c.get('user').id
  const limit = limitParam(c.req.query('limit'), 20, 100)
  const conversations = await withUser(userId, (db) => listConversations(db, userId, limit))
  return c.json(conversations)
})

aiRoutes.get('/ai/conversations/:id', async (c) => {
  const userId = c.get('user').id
  const id = requireUuid(c.req.param('id'))
  const data = await withUser(userId, async (db) => {
    const conversation = await getConversation(db, userId, id)
    if (!conversation) return null
    return { ...conversation, messages: renderForUi(await loadMessages(db, userId, id)) }
  })
  if (!data) throw new HttpError(404, 'Conversation not found')
  return c.json(data)
})

aiRoutes.delete('/ai/conversations/:id', async (c) => {
  const userId = c.get('user').id
  const id = requireUuid(c.req.param('id'))
  if (activeTurns.has(id)) throw new HttpError(409, 'Your coach is still replying in this chat')
  const deleted = await withUser(userId, (db) => deleteConversation(db, userId, id))
  if (!deleted) throw new HttpError(404, 'Conversation not found')
  return c.body(null, 204)
})

function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) return 'Your coach is busy right now. Please try again in a minute.'
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return 'The AI coach is not set up correctly. Please try again later.'
  }
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the AI service. Please try again."
  if (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500) {
    return 'The AI service is having trouble. Please try again in a minute.'
  }
  if (err instanceof HttpError && err.status < 500) return err.message
  return 'Something went wrong while your coach was replying. Please try again.'
}
