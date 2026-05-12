import type { ReactNode } from 'react'
import { TabBar } from './TabBar'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        color: 'var(--text-primary)',
      }}
    >
      <main
        style={{
          flex: 1,
          padding: 'var(--space-lg) var(--space-md) var(--space-xl)',
          paddingTop: 'calc(var(--sa-top) + var(--space-lg))',
          maxWidth: 560,
          width: '100%',
          margin: '0 auto',
        }}
      >
        {children}
      </main>
      <TabBar />
    </div>
  )
}
