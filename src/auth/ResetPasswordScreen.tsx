import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Field } from '../components/Field'
import { PrimaryButton } from '../components/PrimaryButton'
import { Banner } from '../components/Banner'

/**
 * Landing page for the emailed reset link (/reset-password#token=…). The token
 * rides in the URL fragment so it never reaches server or proxy logs.
 */
export function ResetPasswordScreen() {
  const { completePasswordReset } = useAuth()
  const navigate = useNavigate()
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('The passwords don’t match.')
      return
    }
    setSubmitting(true)
    try {
      await completePasswordReset(token, password)
      // Drop the spent token from the address bar and history.
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-panel" style={{ gridColumn: '1 / -1' }}>
        <div className="auth-card">
          <p className="eyebrow accent" style={{ marginBottom: 6 }}>
            Account recovery
          </p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--text-title)', fontWeight: 500, letterSpacing: 'var(--tracking-title)', lineHeight: 1.08 }}>
            Choose a new password
          </h1>
          <p style={{ margin: '10px 0 var(--space-xl)', color: 'var(--text-secondary)', fontSize: 'var(--text-md)', lineHeight: 1.55 }}>
            You’ll be signed in here, and signed out on your other devices.
          </p>

          {!token ? (
            <>
              <Banner tone="error">This reset link is incomplete. Request a new one from the sign-in screen.</Banner>
              <p style={{ margin: 'var(--space-ml) 0 0', textAlign: 'center', fontSize: 'var(--text-sm)' }}>
                <Link to="/login" style={linkStyle}>Back to sign in</Link>
              </p>
            </>
          ) : (
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <Field
                label="New password"
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
              <Field
                label="Confirm password"
                value={confirm}
                onChange={setConfirm}
                type="password"
                autoComplete="new-password"
                placeholder="Type it again"
              />
              {error && <Banner tone="error">{error}</Banner>}
              <PrimaryButton type="submit" loading={submitting} disabled={password.length < 8 || !confirm}>
                Set new password
              </PrimaryButton>
              <p style={{ margin: 0, textAlign: 'center', fontSize: 'var(--text-sm)' }}>
                <Link to="/login" style={{ ...linkStyle, color: 'var(--text-secondary)', fontWeight: 500 }}>Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}

const linkStyle: React.CSSProperties = {
  display: 'inline-flex',
  minHeight: 'var(--tap)',
  alignItems: 'center',
  padding: '0 8px',
  color: 'var(--accent)',
  fontWeight: 600,
}
