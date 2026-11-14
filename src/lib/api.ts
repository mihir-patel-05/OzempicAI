/**
 * Thin client for the OzempicAI API (server/). In production the web service
 * proxies /api on the same origin; in dev Vite proxies it to the local API.
 * VITE_API_URL is only needed when the API lives on another origin.
 */
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')
const SESSION_KEY = 'ozempicai.session'

export interface SessionUser {
  id: string
  email: string
  user_metadata: { name?: string }
}

export interface Session {
  access_token: string
  user: SessionUser
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─── Stored session ─────────────────────────────────────────────────────────

type SessionListener = (session: Session | null) => void
const listeners = new Set<SessionListener>()

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    return parsed?.access_token && parsed.user?.id ? parsed : null
  } catch {
    return null
  }
}

export function storeSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Private mode or storage disabled: the session lives for this tab only.
  }
  for (const listener of listeners) listener(session)
}

export function onSessionChange(listener: SessionListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ─── Requests ───────────────────────────────────────────────────────────────

type QueryValue = string | number | boolean | null | undefined

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, QueryValue>
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  const url = `${BASE}/api${path}${qs ? `?${qs}` : ''}`

  const session = loadSession()
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (session) headers.Authorization = `Bearer ${session.access_token}`

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0)
  }

  if (response.status === 401 && session) {
    // The stored token was revoked or expired: drop it so the app shows login.
    storeSession(null)
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const data = (await response.json()) as { error?: string }
      if (data?.error) message = data.error
    } catch {
      // Non-JSON error body (e.g. a proxy error page).
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
