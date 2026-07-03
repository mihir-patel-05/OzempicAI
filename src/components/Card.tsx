import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

type Pad = 'none' | 'sm' | 'md' | 'lg'

const PAD: Record<Pad, string> = {
  none: '0',
  sm: 'var(--space-sm)',
  md: 'var(--space-md)',
  lg: 'var(--space-lg)',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: Pad
  radius?: 'md' | 'lg' | 'hero'
  elevated?: boolean
}

export function Card({
  children,
  padding = 'md',
  radius = 'lg',
  elevated = true,
  style,
  ...rest
}: CardProps) {
  const merged: CSSProperties = {
    background: 'var(--card-bg)',
    borderRadius: `var(--radius-${radius})`,
    padding: PAD[padding],
    boxShadow: elevated ? '0 4px 16px var(--shadow-soft)' : 'none',
    ...style,
  }
  return (
    <div style={merged} {...rest}>
      {children}
    </div>
  )
}
