import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'

const ITEMS: { to: string; label: string; hint: string }[] = [
  { to: '/log/calories', label: 'Calories', hint: 'Log a meal' },
  { to: '/log/water', label: 'Water', hint: '+250 / +500 ml' },
  { to: '/log/exercise', label: 'Exercise', hint: 'Cardio, strength…' },
  { to: '/log/weight', label: 'Weight', hint: 'One entry per day' },
  { to: '/log/heart-rate', label: 'Heart rate', hint: 'Manual BPM' },
]

export function LogScreen() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 28,
          margin: 0,
        }}
      >
        Log
      </h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 'var(--space-sm)',
        }}
      >
        {ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Card padding="md">
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                }}
              >
                {item.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {item.hint}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
