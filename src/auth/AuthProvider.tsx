import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { api, loadSession, onSessionChange, storeSession } from '../lib/api'
import type { Session, SessionUser } from '../lib/api'

export type { Session } from '../lib/api'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string, inviteToken: string) => Promise<boolean>
  resetPassword: (email: string) => Promise<void>
  completePasswordReset: (token: string, password: string) => Promise<void>
  updatePassword: (currentPassword: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Supabase kept its session under this key; clear it so it doesn't linger.
const LEGACY_SUPABASE_KEY = 'ozempicai.auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  // The stored session is trusted immediately so the installed PWA opens
  // straight into the app (and works offline); it is re-checked below.
  const [session, setSession] = useState<Session | null>(() => loadSession())
  // Nothing to wait for: the stored session (or its absence) is known up front.
  const loading = false

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_SUPABASE_KEY)
    } catch {
      // ignore
    }

    const unsubscribe = onSessionChange(setSession)
    const stored = loadSession()
    if (stored) {
      // Refresh the cached user. A 401 clears the session inside api(), which
      // sends the app back to login; a network error keeps it for offline use.
      api<{ user: SessionUser }>('/auth/user')
        .then(({ user }) => {
          if (loadSession()?.access_token === stored.access_token) {
            storeSession({ ...stored, user })
          }
        })
        .catch(() => {})
    }
    return unsubscribe
  }, [])

  // Health data fetched for one account must not outlive it in memory: when
  // the signed-in user changes (sign-out, expiry, another account), drop every
  // cached query and cancel anything still loading.
  const queryClient = useQueryClient()
  const userId = session?.user.id ?? null
  const previousUserId = useRef(userId)
  useEffect(() => {
    if (previousUserId.current === userId) return
    previousUserId.current = userId
    void queryClient.cancelQueries()
    queryClient.clear()
  }, [queryClient, userId])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      signIn: async (email, password) => {
        const next = await api<Session>('/auth/login', {
          method: 'POST',
          body: { email: email.trim(), password },
        })
        storeSession(next)
      },
      signUp: async (name, email, password, inviteToken) => {
        const next = await api<Session>('/auth/signup', {
          method: 'POST',
          body: { name: name.trim(), email: email.trim(), password, invite_token: inviteToken.trim() },
        })
        storeSession(next)
        return true
      },
      resetPassword: async (email) => {
        await api('/auth/recover', { method: 'POST', body: { email } })
      },
      completePasswordReset: async (token, password) => {
        const next = await api<Session>('/auth/reset', {
          method: 'POST',
          body: { token, password },
        })
        storeSession(next)
      },
      updatePassword: async (currentPassword, password) => {
        await api('/auth/password', { method: 'POST', body: { current_password: currentPassword, password } })
      },
      signOut: async () => {
        try {
          await api('/auth/logout', { method: 'POST' })
        } finally {
          storeSession(null)
        }
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
