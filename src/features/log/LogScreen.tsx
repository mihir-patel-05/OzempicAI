import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'

const ITEMS: { to: string; label: string; hint: string; icon: string; tone: string }[] = [
  { to: '/log/calories', label: 'Meals & calories', hint: 'Track food by meal', icon: '01', tone: 'var(--terracotta)' },
  { to: '/log/water', label: 'Water', hint: 'Quick-add hydration', icon: '02', tone: 'var(--saffron)' },
  { to: '/log/exercise', label: 'Exercise', hint: 'Cardio, strength & more', icon: '03', tone: 'var(--ember)' },
  { to: '/log/weight', label: 'Weight', hint: 'Follow your trend', icon: '04', tone: 'var(--sage-deep)' },
  { to: '/log/heart-rate', label: 'Heart rate', hint: 'Save a BPM reading', icon: '05', tone: 'var(--plum)' },
]

export function LogScreen() {
  return (
    <div className="screen-stack">
      <header>
        <p style={{ margin: '0 0 3px', color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase' }}>Daily check-in</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(32px, 5vw, 42px)', letterSpacing: -1, margin: 0 }}>What would you like to track?</h1>
        <p style={{ maxWidth: 560, margin: '9px 0 8px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>A few seconds of logging gives you a clearer picture of the habits shaping your progress.</p>
      </header>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-sm)',
        }}
      >
        {ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Card padding="lg" style={{ minHeight: 154, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ color: item.tone, fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600 }}>{item.icon}</span>
                <span style={{ color: item.tone, fontSize: 20 }} aria-hidden="true">↗</span>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{item.hint}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
