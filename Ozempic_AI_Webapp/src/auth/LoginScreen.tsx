import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Field } from '../components/Field'
import { PrimaryButton } from '../components/PrimaryButton'
import { Banner } from '../components/Banner'

type Mode = 'signin' | 'signup'
type RedirectFrom =
  | string
  | { pathname?: string; search?: string; hash?: string }

export function LoginScreen() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: RedirectFrom } | null)?.from
  const redirectTo =
    typeof from === 'string'
      ? from
      : `${from?.pathname ?? '/'}${from?.search ?? ''}${from?.hash ?? ''}`

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        navigate(redirectTo, { replace: true })
      } else {
        await signUp(email, password)
        setInfo('Check your email to confirm your account, then sign in.')
        setMode('signin')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background:
          'linear-gradient(180deg, var(--cream) 0%, var(--paper) 100%)',
        paddingTop: 'calc(var(--sa-top) + var(--space-xl))',
        paddingBottom: 'calc(var(--sa-bottom) + var(--space-xl))',
        paddingLeft: 'var(--space-lg)',
        paddingRight: 'var(--space-lg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <BrandMark />

      <form
        onSubmit={onSubmit}
        style={{
          width: '100%',
          maxWidth: 420,
          marginTop: 'var(--space-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
        }}
      >
        <div
          style={{
            background: 'var(--card-bg)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-md)',
            boxShadow: '0 4px 16px var(--shadow-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-md)',
          }}
        >
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="••••••••"
          />
        </div>

        {error && <Banner tone="error">{error}</Banner>}
        {info && <Banner tone="info">{info}</Banner>}

        <PrimaryButton type="submit" loading={submitting} disabled={!email || !password}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </PrimaryButton>

        <button
          type="button"
          onClick={() => {
            setError(null)
            setInfo(null)
            setMode(mode === 'signin' ? 'signup' : 'signin')
          }}
          style={{
            textAlign: 'center',
            fontSize: 13,
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
          ) : (
            <>
              Already have an account?{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}

function BrandMark() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          width: 84,
          height: 84,
          borderRadius: 999,
          background:
            'linear-gradient(135deg, var(--terracotta) 0%, var(--ember) 100%)',
          boxShadow: '0 12px 32px rgba(199,111,74,0.35)',
          display: 'grid',
          placeItems: 'center',
          color: 'white',
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21s-7-4.35-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.65-7 10-7 10z" />
        </svg>
      </div>
      <h1
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 40,
          letterSpacing: -1,
          color: 'var(--text-primary)',
        }}
      >
        OzempicAI
      </h1>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 15,
          color: 'var(--text-secondary)',
        }}
      >
        Your daily health companion
      </p>
    </div>
  )
}
