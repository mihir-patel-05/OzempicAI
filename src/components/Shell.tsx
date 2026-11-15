import { useCallback, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { TabBar } from './TabBar'
import { LogSheet } from './LogSheet'
import { Icon } from './Icon'

export function Shell({ children }: { children: ReactNode }) {
  const [logOpen, setLogOpen] = useState(false)
  const openLog = useCallback(() => setLogOpen(true), [])
  const closeLog = useCallback(() => setLogOpen(false), [])
  // Full-screen chat on phones: no tab bar, so the composer can sit at the
  // bottom edge (and right above the keyboard). The desktop sidebar stays.
  const immersive = useLocation().pathname.startsWith('/coach')

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar" aria-label="Primary navigation">
        <Brand />
        <button type="button" className="btn btn-filled sidebar-log-button" onClick={openLog} aria-haspopup="dialog">
          <Icon name="plus" size={18} strokeWidth={2.2} /> Log something
        </button>
        <TabBar variant="desktop" />
        <p
          style={{
            margin: 'auto 8px 0',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--text-xs)',
            lineHeight: 1.6,
          }}
        >
          Small choices, tracked daily.
        </p>
      </aside>
      <main className={`app-content${immersive ? ' is-immersive' : ''}`}>{children}</main>
      {!immersive && <TabBar variant="mobile" onLog={openLog} logOpen={logOpen} />}
      {logOpen && <LogSheet onClose={closeLog} />}
    </div>
  )
}

function Brand() {
  return (
    <div className="nav-brand">
      <span className="nav-brand-mark" aria-hidden="true">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21s-7-4.35-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.65-7 10-7 10z" />
        </svg>
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 19,
          fontWeight: 600,
          letterSpacing: -0.3,
        }}
      >
        OzempicAI
      </span>
    </div>
  )
}
