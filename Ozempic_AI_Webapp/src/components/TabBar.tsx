import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

interface Tab {
  to: string
  label: string
  icon: ReactNode
}

const TABS: Tab[] = [
  { to: '/', label: 'Today', icon: <IconSun /> },
  { to: '/log', label: 'Log', icon: <IconPlus /> },
  { to: '/plans', label: 'Plans', icon: <IconList /> },
  { to: '/profile', label: 'Profile', icon: <IconPerson /> },
]

export function TabBar() {
  return (
    <nav
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
        background: 'var(--paper)',
        borderTop: '1px solid var(--divider)',
        paddingBottom: 'var(--sa-bottom)',
        boxShadow: '0 -4px 16px var(--shadow-soft)',
      }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 0 12px',
            gap: 2,
            color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
            textDecoration: 'none',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          })}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function IconSun() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

function IconList() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="4" cy="6" r="1.2" />
      <circle cx="4" cy="12" r="1.2" />
      <circle cx="4" cy="18" r="1.2" />
    </svg>
  )
}

function IconPerson() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  )
}
