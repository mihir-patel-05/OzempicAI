import { Card } from '../../components/Card'
import { IconButton } from '../../components/IconButton'
import { shiftDateKey } from '../../lib/date'
import { dayLabel } from './day'

/**
 * Which day the Calories screen shows and logs to: step a day back or
 * forward, or jump to any past day with the native date picker. Future
 * days are off limits.
 */
export function DayPicker({
  value,
  todayKey,
  onChange,
}: {
  value: string
  todayKey: string
  onChange: (key: string) => void
}) {
  const isToday = value === todayKey
  const label = dayLabel(value, todayKey)

  return (
    <Card padding="md">
      <div className="day-picker">
        <IconButton
          icon="chevron"
          label="Previous day"
          className="day-picker-prev"
          onClick={() => onChange(shiftDateKey(value, -1))}
        />
        <div className="day-picker-main">
          <span className="day-picker-label" aria-live="polite">
            {label}
          </span>
          <input
            type="date"
            className="field-input day-picker-input"
            aria-label="Day to log"
            value={value}
            max={todayKey}
            required
            onChange={(e) => {
              // Clearing the field (or typing half a date) leaves it blank; ignore that.
              if (e.target.value) onChange(e.target.value > todayKey ? todayKey : e.target.value)
            }}
          />
        </div>
        <IconButton
          icon="chevron"
          label="Next day"
          disabled={isToday}
          onClick={() => onChange(shiftDateKey(value, 1))}
        />
      </div>
      {!isToday && (
        <button type="button" className="chip day-picker-today" onClick={() => onChange(todayKey)}>
          Back to today
        </button>
      )}
    </Card>
  )
}
