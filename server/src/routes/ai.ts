import Anthropic from '@anthropic-ai/sdk'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { AppEnv } from '../auth.js'
import { rateLimit } from '../auth.js'
import { withUser } from '../db.js'
import { HttpError, limitParam, readJson, requireUuid } from '../http.js'
import {
  AI_MAX_CONCURRENT_TURNS,
  AI_MAX_CONCURRENT_TURNS_PER_USER,
  AI_MAX_CONVERSATION_MESSAGES,
  AI_MAX_TURNS_PER_HOUR,
  AI_MAX_TURNS_PER_HOUR_TOTAL,
  isConfigured,
} from '../ai/client.js'
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
/** Turns in flight per user. */
const activeByUser = new Map<string, number>()
const BUSY = 'Your coach is busy right now. Please try again in a minute.'

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
  const tzFromClient = typeof body.timezone === 'string' && body.timezone !== ''
  const tz = tzFromClient ? (body.timezone as string) : 'UTC'
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
  if ((activeByUser.get(user.id) ?? 0) >= AI_MAX_CONCURRENT_TURNS_PER_USER) {
    throw new HttpError(409, 'Your coach is still replying in another chat. Wait for it to finish.')
  }
  if (activeTurns.size >= AI_MAX_CONCURRENT_TURNS) throw new HttpError(503, BUSY)
  // Counted last, so requests refused above don't use up the shared budget.
  rateLimit('ai-total:all', AI_MAX_TURNS_PER_HOUR_TOTAL, 60 * 60_000, BUSY)

  const { conversationId, title, history, profile } = await withUser(user.id, async (db) => {
    const profileRows = await db.query<CoachProfile>(
      `select name, daily_calorie_goal, daily_water_goal_ml, weight_kg, height_cm, age, unit_system
         from public.users where id = $1`,
      [user.id],
    )
    if (tzFromClient) {
      // Keep the saved timezone current for MCP clients, which don't send one.
      await db.query('update public.users set timezone = $2 where id = $1 and timezone is distinct from $2', [
        user.id,
        tz,
      ])
    }
    if (requestedId) {
      const conversation = await getConversation(db, user.id, requestedId)
      if (!conversation) throw new HttpError(404, 'Conversation not found')
      const history = await loadMessages(db, user.id, conversation.id)
      // The whole history is sent to the model on every turn.
      if (history.length >= AI_MAX_CONVERSATION_MESSAGES) {
        throw new HttpError(400, 'This chat has reached its length limit. Start a new chat to keep going.')
      }
      return {
        conversationId: conversation.id,
        title: conversation.title,
        history,
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
  activeByUser.set(user.id, (activeByUser.get(user.id) ?? 0) + 1)

  return streamSSE(c, async (stream) => {
    const started = Date.now()
    // Writes are queued so events stay in order and the stream isn't closed
    // with some still pending. The turn keeps running if the browser goes
    // away, so the reply and any writes are saved and show up on reload;
    // writes to a closed stream fail quietly.
    let queue = Promise.resolve()
    const send = (event: string, data: unknown) => {
      queue = queue.then(() => stream.writeSSE({ event, data: JSON.stringify(data) })).catch(() => {})
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
      const left = (activeByUser.get(user.id) ?? 1) - 1
      if (left > 0) activeByUser.set(user.id, left)
      else activeByUser.delete(user.id)
      send('done', { conversation_id: conversationId })
      await queue
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
