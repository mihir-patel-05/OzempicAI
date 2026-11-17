import { useId, useState } from 'react'
import { CapsLabel, Field } from '../../components/Field'
import { FAST_PRESETS, MAX_TARGET_MINUTES, isValidTarget, presetFor } from './presets'

interface GoalPickerProps {
  /** The goal to show first. Later changes to it are ignored; remount to reset. */
  initialMinutes: number
  /** The chosen goal in minutes, or null while a custom goal is out of range. */
  onChange: (minutes: number | null) => void
}

const CUSTOM = 'custom'

/** Preset chips (16:8, 18:6, …) plus a custom hours-and-minutes goal. */
export function GoalPicker({ initialMinutes, onChange }: GoalPickerProps) {
  const labelId = useId()
  const [selected, setSelected] = useState(() => presetFor(initialMinutes)?.id ?? CUSTOM)
  const [hours, setHours] = useState(String(Math.floor(initialMinutes / 60)))
  const [minutes, setMinutes] = useState(String(initialMinutes % 60))

  const preset = FAST_PRESETS.find((p) => p.id === selected)
  const customMinutes = toMinutes(hours, minutes)

  function pickPreset(id: string, value: number) {
    setSelected(id)
    // Custom starts from the last preset picked.
    setHours(String(Math.floor(value / 60)))
    setMinutes(String(value % 60))
    onChange(value)
  }

  function pickCustom() {
    setSelected(CUSTOM)
    onChange(customMinutes)
  }

  function editCustom(nextHours: string, nextMinutes: string) {
    setHours(nextHours)
    setMinutes(nextMinutes)
    onChange(toMinutes(nextHours, nextMinutes))
  }

  return (
    <div>
      <CapsLabel id={labelId}>Fasting goal</CapsLabel>
      <div className="chip-row" role="group" aria-labelledby={labelId} style={{ marginTop: 'var(--space-xs)' }}>
        {FAST_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="chip chip-toggle"
            aria-pressed={selected === p.id}
            onClick={() => pickPreset(p.id, p.minutes)}
          >
            {p.label}
          </button>
        ))}
        <button type="button" className="chip chip-toggle" aria-pressed={selected === CUSTOM} onClick={pickCustom}>
          Custom
        </button>
      </div>

      {preset ? (
        <p className="fasting-hint">{preset.hint}</p>
      ) : (
        <>
          <div className="fasting-two-up" style={{ marginTop: 'var(--space-ms)' }}>
            <Field
              label="Hours"
              value={hours}
              onChange={(v) => editCustom(v, minutes)}
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_TARGET_MINUTES / 60}
            />
            <Field
              label="Minutes"
              value={minutes}
              onChange={(v) => editCustom(hours, v)}
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
            />
          </div>
          <p className="fasting-hint" role={customMinutes === null ? 'alert' : undefined}>
            {customMinutes === null ? 'Pick a goal between 1 and 72 hours.' : 'Any goal from 1 to 72 hours.'}
          </p>
        </>
      )}
    </div>
  )
}

function toMinutes(hours: string, minutes: string): number | null {
  const h = Number(hours || 0)
  const m = Number(minutes || 0)
  if (!Number.isInteger(h) || !Number.isInteger(m) || m < 0 || m > 59) return null
  const total = h * 60 + m
  return isValidTarget(total) ? total : null
}
