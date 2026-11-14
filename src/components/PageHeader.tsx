import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  eyebrow?: string
  subtitle?: ReactNode
  /** Route for the back link on sub-screens. */
  back?: string
  backLabel?: string
  action?: ReactNode
}

/** The one header every screen uses: optional back link, eyebrow, title, status line, action. */
export function PageHeader({ title, eyebrow, subtitle, back, backLabel = 'Back', action }: PageHeaderProps) {
  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {back && (
        <Link to={back} className="back-link" style={{ alignSelf: 'flex-start' }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {backLabel}
        </Link>
      )}
      <div className="page-header">
        <div style={{ minWidth: 0 }}>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        {action && <div style={{ flex: 'none' }}>{action}</div>}
      </div>
    </header>
  )
}

export function SectionHeader({
  title,
  meta,
  action,
  id,
  as: Tag = 'h2',
}: {
  title: string
  meta?: ReactNode
  action?: ReactNode
  id?: string
  as?: 'h2' | 'h3'
}) {
  return (
    <div className="section-header">
      <Tag id={id}>{title}</Tag>
      {action ?? (meta && <span className="meta">{meta}</span>)}
    </div>
  )
}
