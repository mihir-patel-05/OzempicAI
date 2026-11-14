import type { InputHTMLAttributes, ReactNode } from 'react'

interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
}

export function Field({ label, value, onChange, hint, style, ...rest }: FieldProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <CapsLabel>{label}</CapsLabel>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="field-input"
        style={style}
        {...rest}
      />
      {hint && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{hint}</span>
      )}
    </label>
  )
}

export function CapsLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <span className="eyebrow" id={id} style={{ color: 'var(--text-secondary)' }}>
      {children}
    </span>
  )
}
