import type { InputHTMLAttributes } from 'react'

interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
}

export function Field({ label, value, onChange, hint, ...rest }: FieldProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <CapsLabel>{label}</CapsLabel>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        style={{
          background: 'var(--cream-dim)',
          border: '1px solid var(--divider)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          fontSize: 16,
          color: 'var(--text-primary)',
        }}
        {...rest}
      />
      {hint && (
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{hint}</span>
      )}
    </label>
  )
}

export function CapsLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: 'var(--text-secondary)',
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  )
}
