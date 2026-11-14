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
        background: isError ? 'var(--danger-tint)' : 'var(--success-tint)',
        color: 'var(--text-primary)',
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  )
}
