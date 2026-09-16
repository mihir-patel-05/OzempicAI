import type { ReactNode } from 'react'
import { TabBar } from './TabBar'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar" aria-label="Primary navigation">
        <Brand />
        <TabBar variant="desktop" />
        <p
          style={{
            margin: 'auto 8px 0',
            color: 'var(--text-tertiary)',
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          Small choices, tracked daily.
        </p>
      </aside>
      <main className="app-content">{children}</main>
      <TabBar variant="mobile" />
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
