import { Card } from '../../components/Card'

export function PlansScreen() {
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
        Plans
      </h1>
      <Card padding="md">
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          Read-only view of your meal plans and grocery list. The Mac app is the
          place to edit them.
        </p>
      </Card>
    </div>
  )
}
