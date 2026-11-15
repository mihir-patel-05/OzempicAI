import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { api } from '../lib/api'
import { Banner } from '../components/Banner'
import { PrimaryButton } from '../components/PrimaryButton'
import { SegmentedPicker } from '../components/SegmentedPicker'

type Scope = 'read' | 'write'
type Access = 'edit' | 'read'

interface AuthorizeDetails {
  client_name: string
  redirect_to_label: string
  scopes: Scope[]
}

type Loaded = { kind: 'details'; details: AuthorizeDetails } | { kind: 'redirect'; to: string }

/**
 * OAuth consent screen. An AI app (e.g. Claude) sends the user here to
 * connect to their account; RequireAuth makes sure they're signed in first.
 * The API validates the request and issues the code; this screen only asks.
 */
export function AuthorizeAppScreen() {
  const { session, signOut } = useAuth()
  const location = useLocation()
  const params = useMemo(() => Object.fromEntries(new URLSearchParams(location.search)), [location.search])

  const [details, setDetails] = useState<AuthorizeDetails | null>(null)
  const [access, setAccess] = useState<Access>('edit')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<'allow' | 'deny' | null>(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<AuthorizeDetails | { redirect_to: string }>('/oauth/authorize', { query: params })
      .then((data): Loaded => ('redirect_to' in data ? { kind: 'redirect', to: data.redirect_to } : { kind: 'details', details: data }))
      .then((loaded) => {
        if (cancelled) return
        if (loaded.kind === 'redirect') leave(loaded.to)
        else setDetails(loaded.details)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'This connection request could not be checked.')
      })
    return () => {
      cancelled = true
    }
  }, [params])

  function leave(to: string) {
    setLeaving(true)
    window.location.assign(to)
  }

  async function decide(decision: 'allow' | 'deny') {
    if (!details) return
    setError(null)
    setSubmitting(decision)
    try {
      const scopes: Scope[] = access === 'edit' ? details.scopes : ['read']
      const result = await api<{ redirect_to: string }>('/oauth/authorize', {
        method: 'POST',
        body: { params, decision, scopes },
      })
      leave(result.redirect_to)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSubmitting(null)
    }
  }

  const canWrite = details?.scopes.includes('write') ?? false

  return (
    <div className="auth-layout" style={{ gridTemplateColumns: '1fr' }}>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="nav-brand" style={{ marginBottom: 'var(--space-2xl)' }}>
            <span className="nav-brand-mark" aria-hidden="true">
              <HeartIcon />
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600 }}>
              OzempicAI
            </span>
          </div>

          {leaving ? (
            <p role="status" style={subtitleStyle}>
              Returning you to the app…
            </p>
          ) : !details ? (
            error ? (
              <>
                <h1 style={titleStyle}>This connection can’t continue</h1>
                <div style={{ margin: 'var(--space-lg) 0' }}>
                  <Banner tone="error">{error}</Banner>
                </div>
                <a href="/" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                  Go to OzempicAI
                </a>
              </>
            ) : (
              <p role="status" style={subtitleStyle}>
                Checking the request…
              </p>
            )
          ) : (
            <>
              <p className="eyebrow accent" style={{ marginBottom: 6 }}>
                Connect an AI app
              </p>
              <h1 style={titleStyle}>
                Allow {details.client_name} to use your OzempicAI account?
              </h1>
              <p style={subtitleStyle}>
                Signed in as <strong>{session?.user.email}</strong>.{' '}
                <button type="button" onClick={() => void signOut()} style={linkButtonStyle}>
                  Not you?
                </button>
                <br />
                You’ll go back to <strong>{details.redirect_to_label}</strong>.
              </p>

              <h2 style={sectionHeadingStyle}>{details.client_name} will be able to</h2>
              <ul style={listStyle}>
                <li>
                  Read your calorie, weight and exercise history, your workout plan, meal plan and grocery list
                </li>
                {canWrite && access === 'edit' && <li>Add and edit planned workouts, planned meals and grocery items</li>}
              </ul>

              {canWrite && (
                <div style={{ margin: 'var(--space-lg) 0' }}>
                  <p id="access-label" style={sectionHeadingStyle}>
                    Access
                  </p>
                  <SegmentedPicker<Access>
                    ariaLabelledBy="access-label"
                    value={access}
                    onChange={setAccess}
                    options={[
                      { value: 'edit', label: 'Read and edit' },
                      { value: 'read', label: 'Read only' },
                    ]}
                  />
                </div>
              )}

              <p style={noteStyle}>
                Only allow this if you just asked {details.client_name} to connect to OzempicAI. You can disconnect it
                any time in Profile → Connected AI apps.
              </p>

              {error && (
                <div style={{ marginBottom: 'var(--space-md)' }}>
                  <Banner tone="error">{error}</Banner>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                <PrimaryButton
                  type="button"
                  loading={submitting === 'allow'}
                  disabled={submitting !== null}
                  onClick={() => void decide('allow')}
                >
                  Allow
                </PrimaryButton>
                <PrimaryButton
                  type="button"
                  variant="outline"
                  loading={submitting === 'deny'}
                  disabled={submitting !== null}
                  onClick={() => void decide('deny')}
                >
                  Cancel
                </PrimaryButton>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
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
  overflowWrap: 'anywhere',
}

const subtitleStyle: React.CSSProperties = {
  margin: '10px 0 var(--space-xl)',
  color: 'var(--text-secondary)',
  fontSize: 'var(--text-md)',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const sectionHeadingStyle: React.CSSProperties = {
  margin: '0 0 8px',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
}

const listStyle: React.CSSProperties = {
  margin: '0 0 var(--space-md)',
  paddingLeft: 20,
  color: 'var(--text-secondary)',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.6,
}

const noteStyle: React.CSSProperties = {
  margin: '0 0 var(--space-lg)',
  color: 'var(--text-tertiary)',
  fontSize: 'var(--text-xs)',
  lineHeight: 1.6,
}

const linkButtonStyle: React.CSSProperties = {
  color: 'var(--accent)',
  fontWeight: 600,
  padding: 0,
}
