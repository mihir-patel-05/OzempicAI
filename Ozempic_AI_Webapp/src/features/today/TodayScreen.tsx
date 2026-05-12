import { Card } from '../../components/Card'
import { Ring } from '../../components/Ring'

export function TodayScreen() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
      }}
    >
      <header>
        <p
          style={{
            margin: 0,
            color: 'var(--text-tertiary)',
            fontSize: 12,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          Today
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 34,
            margin: 0,
            color: 'var(--text-primary)',
          }}
        >
          Good morning
        </h1>
      </header>

      <Card padding="lg" radius="hero">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--space-md)',
            placeItems: 'center',
          }}
        >
          <RingStub label="Calories" value={0} goal={2000} color="var(--calorie-ring)" unit="kcal" />
          <RingStub label="Water" value={0} goal={2500} color="var(--water-fill)" unit="ml" />
          <RingStub label="Exercise" value={0} goal={30} color="var(--exercise-ring)" unit="min" />
        </div>
      </Card>

      <Card padding="md">
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          Connect your account to see today's totals. Auth comes in the next phase.
        </p>
      </Card>
    </div>
  )
}

function RingStub({
  label,
  value,
  goal,
  color,
  unit,
}: {
  label: string
  value: number
  goal: number
  color: string
  unit: string
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <Ring value={value} goal={goal} color={color} size={92} stroke={10} label={label}>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 18,
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            {value}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{unit}</div>
        </div>
      </Ring>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 11,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </p>
    </div>
  )
}
