import { useState } from 'react'
import { Card } from '../../components/Card'
import { useAuth } from '../../auth/AuthProvider'

export function ProfileScreen() {
  const { session, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const email = session?.user.email ?? '—'

  async function onSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 28,
          margin: 0,
        }}
      >
        Profile
      </h1>

      <Card padding="md">
        <div
          style={{
            fontSize: 11,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            fontWeight: 600,
          }}
        >
          Signed in as
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            color: 'var(--text-primary)',
            marginTop: 4,
            wordBreak: 'break-all',
          }}
        >
          {email}
        </div>
      </Card>

      <Card padding="md">
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          Daily goal editing arrives in a later phase.
        </p>
      </Card>

      <button
        onClick={onSignOut}
        disabled={signingOut}
        style={{
          background: 'transparent',
          color: 'var(--ember)',
          border: '1px solid var(--ember)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          fontSize: 15,
          fontWeight: 600,
          opacity: signingOut ? 0.6 : 1,
        }}
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  )
}
