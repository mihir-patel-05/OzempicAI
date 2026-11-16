import { useState } from 'react'
import { Banner } from '../../components/Banner'
import { Card } from '../../components/Card'
import { SectionHeader } from '../../components/PageHeader'
import { PrimaryButton } from '../../components/PrimaryButton'
import { useConnections, useDisconnect, useMcpAvailable } from '../../hooks/useConnections'
import type { Connection } from '../../hooks/useConnections'

/** Profile → Connected AI apps: Claude and other apps linked over MCP. */
export function ConnectedApps() {
  const connections = useConnections()
  const available = useMcpAvailable()
  const disconnect = useDisconnect()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const serverUrl = available.data ?? null

  async function copyUrl() {
    if (!serverUrl) return
    try {
      await navigator.clipboard.writeText(serverUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the URL is shown for manual copying.
    }
  }

  const list = connections.data ?? []

  return (
    <Card padding="lg">
      <SectionHeader title="Connected AI apps" />
      {connections.isLoading ? (
        <p className="empty-note">Loading…</p>
      ) : connections.isError ? (
        <Banner tone="error">Couldn’t load your connected apps.</Banner>
      ) : (
        <>
          {list.length > 0 && (
            <ul style={{ listStyle: 'none', margin: '0 0 var(--space-md)', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {list.map((connection) => (
                <li key={connection.id}>
                  <Card variant="inset" padding="md" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{connection.client_name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>
                        {describe(connection)}
                      </div>
                    </div>
                    {confirming === connection.id ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <PrimaryButton
                          type="button"
                          tone="danger"
                          loading={disconnect.isPending}
                          onClick={() => disconnect.mutate(connection.id, { onSettled: () => setConfirming(null) })}
                          style={smallButton}
                        >
                          Disconnect
                        </PrimaryButton>
                        <PrimaryButton type="button" variant="outline" onClick={() => setConfirming(null)} style={smallButton}>
                          Keep
                        </PrimaryButton>
                      </div>
                    ) : (
                      <PrimaryButton
                        type="button"
                        variant="outline"
                        tone="danger"
                        onClick={() => setConfirming(connection.id)}
                        style={smallButton}
                        aria-label={`Disconnect ${connection.client_name}`}
                      >
                        Disconnect
                      </PrimaryButton>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
          {disconnect.isError && <Banner tone="error">Couldn’t disconnect. Please try again.</Banner>}

          {serverUrl ? (
            <>
              <p className="empty-note" style={{ marginBottom: 'var(--space-sm)' }}>
                {list.length === 0 ? 'No AI apps are connected. ' : ''}
                To plan workouts, meals and groceries by chatting with Claude, add OzempicAI as a custom connector on
                claude.ai (Settings → Connectors) with this URL. It then works in the Claude iPhone app too.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                <code style={urlStyle}>{serverUrl}</code>
                <PrimaryButton type="button" variant="outline" onClick={() => void copyUrl()} style={smallButton}>
                  {copied ? 'Copied' : 'Copy'}
                </PrimaryButton>
              </div>
            </>
          ) : (
            list.length === 0 &&
            !available.isLoading && <p className="empty-note">Connecting AI apps isn’t turned on for this server yet.</p>
          )}
        </>
      )}
    </Card>
  )
}

function describe(connection: Connection): string {
  const access = connection.scopes.includes('write') ? 'Read and edit' : 'Read only'
  const used = connection.last_used_at ? `last used ${relative(connection.last_used_at)}` : 'not used yet'
  return `${access} · connected ${shortDate(connection.created_at)} · ${used}`
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function relative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return shortDate(iso)
}

const smallButton: React.CSSProperties = {
  minHeight: 36,
  padding: '0 12px',
  fontSize: 'var(--text-sm)',
  width: 'auto',
  flexShrink: 0,
}

const urlStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-inset)',
  fontSize: 'var(--text-xs)',
  overflowWrap: 'anywhere',
}
