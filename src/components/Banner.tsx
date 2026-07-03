import type { ReactNode } from 'react'

export function Banner({
  tone,
  children,
}: {
  tone: 'error' | 'info'
  children: ReactNode
}) {
  const isError = tone === 'error'
  return (
    <div
      role={isError ? 'alert' : 'status'}
      style={{
        background: isError ? 'rgba(184,68,31,0.12)' : 'rgba(138,160,125,0.18)',
        color: 'var(--text-primary)',
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  )
}
