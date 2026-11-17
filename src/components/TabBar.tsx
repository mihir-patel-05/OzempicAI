import { NavLink, useLocation } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

interface Tab {
  to: string
  label: string
  icon: IconName
}

const LEFT: Tab[] = [
  { to: '/', label: 'Today', icon: 'sun' },
  { to: '/plans', label: 'Plans', icon: 'list' },
]
const RIGHT: Tab[] = [
  { to: '/analytics', label: 'Analytics', icon: 'chart' },
  { to: '/profile', label: 'Profile', icon: 'person' },
]
// Fasting is a sidebar tab on desktop only. The phone bar has no room for a
// fifth tab, so phones reach it from the fasting card on Today.
const DESKTOP: Tab[] = [
  { to: '/', label: 'Today', icon: 'sun' },
  { to: '/log', label: 'Log', icon: 'plus' },
  { to: '/plans', label: 'Plans', icon: 'list' },
  { to: '/fasting', label: 'Fasting', icon: 'timer' },
  { to: '/analytics', label: 'Analytics', icon: 'chart' },
  { to: '/profile', label: 'Profile', icon: 'person' },
]

interface TabBarProps {
  variant?: 'mobile' | 'desktop'
  onLog?: () => void
  logOpen?: boolean
}

export function TabBar({ variant = 'mobile', onLog, logOpen = false }: TabBarProps) {
  const { pathname } = useLocation()
  if (variant === 'desktop') {
    return (
      <nav className="nav-links">
        {DESKTOP.map((tab) => (
          <TabLink key={tab.to} tab={tab} />
        ))}
      </nav>
    )
  }
  const onLogRoute = pathname.startsWith('/log')
  return (
    <nav className="mobile-tab-bar" aria-label="Primary navigation">
      {LEFT.map((tab) => (
        <TabLink key={tab.to} tab={tab} />
      ))}
      <div className="nav-fab-slot">
        <button
          type="button"
          className="nav-fab"
          aria-label="Log something"
          aria-haspopup="dialog"
          aria-expanded={logOpen}
          aria-current={onLogRoute ? 'page' : undefined}
          onClick={onLog}
        >
          <Icon name="plus" size={26} strokeWidth={2.2} />
        </button>
      </div>
      {RIGHT.map((tab) => (
        <TabLink key={tab.to} tab={tab} />
      ))}
    </nav>
  )
}

function TabLink({ tab }: { tab: Tab }) {
  return (
    <NavLink to={tab.to} end={tab.to === '/'} className="nav-link">
      <Icon name={tab.icon} size={22} strokeWidth={1.7} />
      <span>{tab.label}</span>
    </NavLink>
  )
}
