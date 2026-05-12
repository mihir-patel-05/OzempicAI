import type { ReactNode } from 'react'

interface RingProps {
  value: number
  goal: number
  color?: string
  trackColor?: string
  size?: number
  stroke?: number
  children?: ReactNode
  label?: string
}

export function Ring({
  value,
  goal,
  color = 'var(--accent)',
  trackColor = 'var(--ring-track)',
  size = 160,
  stroke = 14,
  children,
  label,
}: RingProps) {
  const safeGoal = goal > 0 ? goal : 1
  const progress = Math.max(0, Math.min(value / safeGoal, 1))
  const radius = Math.max(0, (size - stroke) / 2)
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
      }}
      role="img"
      aria-label={label ?? `${Math.round(progress * 100)}% of goal`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 360ms ease-out' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        {children}
      </div>
    </div>
  )
}
