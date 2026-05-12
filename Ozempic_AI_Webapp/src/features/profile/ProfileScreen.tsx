import { Card } from '../../components/Card'

export function ProfileScreen() {
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
        Profile
      </h1>
      <Card padding="md">
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          Daily goals and account settings will live here. Sign-in arrives in
          the next phase.
        </p>
      </Card>
    </div>
  )
}
