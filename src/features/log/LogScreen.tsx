import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { LOG_ITEMS } from '../../components/LogSheet'
import { PageHeader } from '../../components/PageHeader'

export function LogScreen() {
  return (
    <div className="screen-stack">
      <PageHeader eyebrow="Daily check-in" title="Log" subtitle="Pick what you want to record. It takes a few seconds." />
      <div className="log-hub-grid">
        {LOG_ITEMS.map((item) => (
          <Link key={item.to} to={item.to} className="log-hub-card">
            <span className="tile-icon" style={{ ['--tone' as string]: item.tone }}>
              <Icon name={item.icon} />
            </span>
            <span>
              <strong>{item.label}</strong>
              <span className="hint">{item.hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
