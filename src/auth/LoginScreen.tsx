import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Field } from '../components/Field'
import { PrimaryButton } from '../components/PrimaryButton'
import { Banner } from '../components/Banner'

type Mode = 'signin' | 'signup' | 'forgot'
type RedirectFrom =
  | string
  | { pathname?: string; search?: string; hash?: string }

export function LoginScreen() {
  const { session, loading, signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: RedirectFrom } | null)?.from
  const redirectTo =
    typeof from === 'string'
      ? from
      : `${from?.pathname ?? '/'}${from?.search ?? ''}${from?.hash ?? ''}`

  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && session) navigate(redirectTo, { replace: true })
  }, [loading, navigate, redirectTo, session])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      if (mode === 'forgot') {
        await resetPassword(email.trim())
        setInfo('Password reset link sent. Check your inbox.')
      } else if (mode === 'signin') {
        await signIn(email, password)
        navigate(redirectTo, { replace: true })
      } else {
        const signedIn = await signUp(name, email, password)
        if (signedIn) {
          navigate(redirectTo, { replace: true })
        } else {
          setInfo('Check your email to confirm your account, then sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-story" aria-label="OzempicAI introduction">
        <div className="nav-brand">
          <span className="nav-brand-mark" aria-hidden="true">
            <HeartIcon />
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600 }}>
            OzempicAI
          </span>
        </div>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
          <p className="eyebrow" style={{ margin: '0 0 18px', color: 'rgba(255,255,255,.6)' }}>
            Your health, in context
          </p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(42px, 5vw, 72px)', fontWeight: 500, lineHeight: 1.02, letterSpacing: 'var(--tracking-title)' }}>
            Progress lives in the everyday.
          </h1>
          <p style={{ maxWidth: 460, margin: '24px 0 0', color: 'rgba(255,255,255,.72)', fontSize: 'var(--text-input)', lineHeight: 1.7 }}>
            Track meals, hydration, movement, weight, and heart rate in one calm daily ritual.
          </p>
        </div>
        <p style={{ position: 'relative', zIndex: 1, margin: 0, color: 'rgba(255,255,255,.6)', fontSize: 'var(--text-xs)' }}>
          Built for steady, sustainable change.
        </p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="nav-brand" style={{ marginBottom: 'var(--space-2xl)' }}>
            <span className="nav-brand-mark" aria-hidden="true"><HeartIcon /></span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600 }}>OzempicAI</span>
          </div>
          <p className="eyebrow accent" style={{ marginBottom: 6 }}>
            {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Start your journey' : 'Account recovery'}
          </p>
          <h1 style={titleStyle}>
            {mode === 'signin' ? 'Sign in to continue' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
          </h1>
          <p style={subtitleStyle}>
            {mode === 'forgot' ? 'We’ll send a secure reset link to your email.' : 'Private by default. Your entries are visible only to you.'}
          </p>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {mode === 'signup' && (
              <Field
                label="Name"
                value={name}
                onChange={setName}
                autoComplete="name"
                placeholder="Your name"
              />
            )}
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            autoCapitalize="none"
          />
          {mode !== 'forgot' && (
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="At least 8 characters"
            />
          )}

          {mode === 'signin' && (
            <button type="button" onClick={() => switchMode('forgot')} style={{ alignSelf: 'flex-end', minHeight: 'var(--tap)', margin: '-14px -8px -8px 0', padding: '0 8px', color: 'var(--accent)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              Forgot password?
            </button>
          )}

        {error && <Banner tone="error">{error}</Banner>}
        {info && <Banner tone="info">{info}</Banner>}

        <PrimaryButton type="submit" loading={submitting} disabled={!email.trim() || (mode !== 'forgot' && (!password || (mode === 'signup' && (!name.trim() || password.length < 8))))}>
          {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </PrimaryButton>

        <button
          type="button"
          onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
          style={{
            minHeight: 'var(--tap)',
            textAlign: 'center',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}
        >
          {mode === 'signin' ? (
            <>
              New here?{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                Create an account
              </span>
            </>
          ) : mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</span>
            </>
          ) : (
            <>Remembered it? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Back to sign in</span></>
          )}
        </button>
          </form>
          <p style={{ margin: 'var(--space-lg) 0 0', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', lineHeight: 1.6, textAlign: 'center' }}>
            By continuing, you agree to use OzempicAI as a wellness tracker—not a substitute for medical advice.
          </p>
        </div>
      </section>
    </div>
  )

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }
}

function HeartIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21s-7-4.35-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.65-7 10-7 10z" />
    </svg>
  )
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontSize: 'var(--text-title)',
  fontWeight: 500,
  letterSpacing: 'var(--tracking-title)',
  lineHeight: 1.08,
}

const subtitleStyle: React.CSSProperties = {
  margin: '10px 0 var(--space-xl)',
  color: 'var(--text-secondary)',
  fontSize: 'var(--text-md)',
  lineHeight: 1.55,
}
