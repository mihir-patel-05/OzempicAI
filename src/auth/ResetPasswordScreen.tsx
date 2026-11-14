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
          <p style={{ margin: '0 0 6px', color: 'var(--accent)', fontSize: 11, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase' }}>
            Account recovery
          </p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500, letterSpacing: -0.8 }}>
            Choose a new password
          </h1>
          <p style={{ margin: '9px 0 28px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
            You’ll be signed in here, and signed out on your other devices.
          </p>

          {!token ? (
            <>
              <Banner tone="error">This reset link is incomplete. Request a new one from the sign-in screen.</Banner>
              <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13 }}>
                <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Back to sign in</Link>
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
              <p style={{ margin: 0, textAlign: 'center', fontSize: 13 }}>
                <Link to="/login" style={{ color: 'var(--text-secondary)' }}>Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
