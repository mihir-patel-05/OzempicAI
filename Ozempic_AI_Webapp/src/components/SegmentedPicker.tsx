interface Option<T extends string> {
  value: T
  label: string
}

interface SegmentedPickerProps<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (next: T) => void
  ariaLabel?: string
  ariaLabelledBy?: string
}

export function SegmentedPicker<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  ariaLabelledBy,
}: SegmentedPickerProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      style={{
        display: 'flex',
        gap: 4,
        background: 'var(--cream-dim)',
        padding: 4,
        borderRadius: 'var(--radius-md)',
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 600,
              background: selected ? 'var(--paper)' : 'transparent',
              color: selected ? 'var(--accent)' : 'var(--text-secondary)',
              boxShadow: selected ? '0 1px 3px var(--shadow-soft)' : 'none',
              transition: 'background 120ms ease-out, color 120ms ease-out',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
