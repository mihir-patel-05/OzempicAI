import { useNavigate } from 'react-router-dom'

export function ScreenHeader({
  title,
  subtitle,
  back = '/log',
}: {
  title: string
  subtitle?: string
  back?: string
}) {
  const navigate = useNavigate()
  return (
    <header
      style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}
    >
      <button
        type="button"
        onClick={() => navigate(back)}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: 'var(--text-secondary)',
          fontSize: 13,
          padding: '4px 8px 4px 0',
          marginLeft: -4,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </button>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 28,
          margin: 0,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          style={{
            margin: 0,
            color: 'var(--text-tertiary)',
            fontSize: 13,
          }}
        >
          {subtitle}
        </p>
      )}
    </header>
  )
}
