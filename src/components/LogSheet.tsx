import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

export const LOG_ITEMS: { to: string; label: string; hint: string; icon: IconName; tone: string }[] = [
  { to: '/log/calories', label: 'Meal', hint: 'Calories by meal', icon: 'fork', tone: 'var(--terracotta)' },
  { to: '/log/water', label: 'Water', hint: 'One-tap hydration', icon: 'drop', tone: 'var(--saffron)' },
  { to: '/log/workout', label: 'Workout', hint: 'Sets, machines & load', icon: 'dumbbell', tone: 'var(--ember)' },
  { to: '/log/exercise', label: 'Exercise', hint: 'Cardio & quick activity', icon: 'run', tone: 'var(--ember)' },
  { to: '/log/weight', label: 'Weight', hint: 'Follow your trend', icon: 'scale', tone: 'var(--sage-deep)' },
  { to: '/log/heart-rate', label: 'Heart rate', hint: 'Save a BPM reading', icon: 'heart', tone: 'var(--plum)' },
]

/** Bottom sheet (centred dialog on desktop) for logging anything from any screen. */
export function LogSheet({ onClose }: { onClose: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    sheetRef.current?.querySelector<HTMLElement>('a, button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && sheetRef.current) {
        const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('a, button'))
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="section-header" style={{ alignItems: 'center' }}>
          <h2 id="log-sheet-title">Log something</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="sheet-grid">
          {LOG_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className="sheet-tile" onClick={onClose}>
              <span className="tile-icon" style={{ ['--tone' as string]: item.tone }}>
                <Icon name={item.icon} />
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
