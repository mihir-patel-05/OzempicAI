import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

type Pad = 'none' | 'sm' | 'md' | 'lg'

const PAD: Record<Pad, string> = {
  none: '0',
  sm: 'var(--space-sm)',
  md: 'var(--space-md)',
  lg: 'var(--space-ml)',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: Pad
  radius?: 'md' | 'lg' | 'hero'
  elevated?: boolean
  /** `inset` is a flat tile used inside another card. */
  variant?: 'default' | 'inset'
}

export function Card({
  children,
  padding = 'md',
  radius = 'lg',
  elevated = true,
  variant = 'default',
  style,
  ...rest
}: CardProps) {
  const inset = variant === 'inset'
  const merged: CSSProperties = {
    background: inset ? 'var(--surface-inset)' : 'var(--card-bg)',
    borderRadius: `var(--radius-${inset ? 'md' : radius})`,
    padding: PAD[padding],
    boxShadow: elevated && !inset ? 'var(--shadow-card)' : 'none',
    minWidth: 0,
    ...style,
  }
  return (
    <div style={merged} {...rest}>
      {children}
    </div>
  )
}
