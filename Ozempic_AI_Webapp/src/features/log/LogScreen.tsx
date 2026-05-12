import { Card } from '../../components/Card'

const ITEMS = [
  { label: 'Calories', hint: 'Log a meal' },
  { label: 'Water', hint: '+250 / +500 ml' },
  { label: 'Exercise', hint: 'Cardio, strength…' },
  { label: 'Weight', hint: 'One entry per day' },
  { label: 'Heart rate', hint: 'Manual BPM' },
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
          <Card key={item.label} padding="md">
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 500,
              }}
            >
              {item.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {item.hint}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
