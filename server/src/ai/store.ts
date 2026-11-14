import type { Db } from '../db.js'
import { HttpError } from '../http.js'
import type { StoredMessage } from './history.js'

/**
 * Persistence for coach conversations (tables from migration 00012_ai_coach).
 * Every function takes a client from withUser(), so row level security limits
 * it to the caller's rows; the explicit user_id filters are belt and braces.
 */

export interface ConversationRow {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface NewMessage {
  role: StoredMessage['role']
  content: unknown
  usage?: { input_tokens: number; output_tokens: number; cache_read_tokens: number }
}

export async function createConversation(db: Db, userId: string, title: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'insert into public.ai_conversations (user_id, title) values ($1, $2) returning id',
    [userId, title],
  )
  return rows[0]!.id
}

export async function getConversation(db: Db, userId: string, id: string): Promise<ConversationRow | null> {
  const { rows } = await db.query<ConversationRow>(
    `select id, title, created_at, updated_at from public.ai_conversations
      where id = $1 and user_id = $2`,
    [id, userId],
  )
  return rows[0] ?? null
}

export async function listConversations(db: Db, userId: string, limit: number): Promise<ConversationRow[]> {
  const { rows } = await db.query<ConversationRow>(
    `select id, title, created_at, updated_at from public.ai_conversations
      where user_id = $1
      order by updated_at desc
      limit $2`,
    [userId, limit],
  )
  return rows
}

export async function deleteConversation(db: Db, userId: string, id: string): Promise<boolean> {
  const result = await db.query('delete from public.ai_conversations where id = $1 and user_id = $2', [id, userId])
  return (result.rowCount ?? 0) > 0
}

export async function loadMessages(db: Db, userId: string, conversationId: string): Promise<StoredMessage[]> {
  const { rows } = await db.query<StoredMessage>(
    `select id, position, role, content from public.ai_messages
      where conversation_id = $1 and user_id = $2
      order by position`,
    [conversationId, userId],
  )
  return rows
}

/**
 * Append messages at `nextPosition` onward and bump the conversation. The
 * unique (conversation_id, position) constraint rejects a concurrent writer.
 * Returns the next free position.
 */
export async function appendMessages(
  db: Db,
  userId: string,
  conversationId: string,
  nextPosition: number,
  messages: NewMessage[],
): Promise<number> {
  let position = nextPosition
  for (const message of messages) {
    // Insert only into a conversation the caller owns.
    const result = await db.query(
      `insert into public.ai_messages
         (conversation_id, user_id, position, role, content, input_tokens, output_tokens, cache_read_tokens)
       select c.id, c.user_id, $3, $4, $5::jsonb, $6, $7, $8
         from public.ai_conversations c
        where c.id = $1 and c.user_id = $2`,
      [
        conversationId,
        userId,
        position,
        message.role,
        JSON.stringify(message.content),
        message.usage?.input_tokens ?? null,
        message.usage?.output_tokens ?? null,
        message.usage?.cache_read_tokens ?? null,
      ],
    )
    if (result.rowCount !== 1) throw new HttpError(404, 'Conversation not found')
    position += 1
  }
  await db.query('update public.ai_conversations set updated_at = now() where id = $1 and user_id = $2', [
    conversationId,
    userId,
  ])
  return position
}
