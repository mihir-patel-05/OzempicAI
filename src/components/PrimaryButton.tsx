import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  variant?: 'filled' | 'outline'
  tone?: 'accent' | 'danger'
  children: ReactNode
}

export function PrimaryButton({
  loading,
  variant = 'filled',
  tone = 'accent',
  disabled,
  children,
  style,
  className,
  ...rest
}: PrimaryButtonProps) {
  const toneStyle =
    tone === 'danger' ? ({ '--btn-color': 'var(--danger)' } as CSSProperties) : undefined
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn btn-${variant}${className ? ` ${className}` : ''}`}
      style={{ ...toneStyle, ...style }}
      {...rest}
    >
      {loading ? 'Saving…' : children}
    </button>
  )
}
