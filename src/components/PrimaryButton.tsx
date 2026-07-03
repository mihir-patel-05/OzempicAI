import type { ButtonHTMLAttributes, ReactNode } from 'react'

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
  ...rest
}: PrimaryButtonProps) {
  const baseColor = tone === 'danger' ? 'var(--ember)' : 'var(--cta)'
  const isFilled = variant === 'filled'
  const dim = disabled || loading
  return (
    <button
      disabled={dim}
      style={{
        background: isFilled ? baseColor : 'transparent',
        color: isFilled ? 'white' : baseColor,
        border: isFilled ? 'none' : `1px solid ${baseColor}`,
        borderRadius: 'var(--radius-md)',
        padding: '13px 16px',
        fontSize: 15,
        fontWeight: 600,
        opacity: dim ? 0.55 : 1,
        transition: 'opacity 120ms ease-out, transform 120ms ease-out',
        ...style,
      }}
      {...rest}
    >
      {loading ? 'Working…' : children}
    </button>
  )
}
