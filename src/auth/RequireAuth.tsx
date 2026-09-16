import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--bg)',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-display)',
          fontSize: 15,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div className="nav-brand-mark" style={{ margin: '0 auto 14px' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21s-7-4.35-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.65-7 10-7 10z" />
            </svg>
          </div>
          Preparing your day…
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
