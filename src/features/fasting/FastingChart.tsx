import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import type { FastingDay } from './stats'

/**
 * Hours fasted per day (one series, so no colour legend is needed beyond the
 * goal key), with a short neutral tick at each day's goal. Loaded lazily:
 * Recharts stays out of the main bundle, as it does for Analytics.
 */
export function FastingChart({ rows }: { rows: FastingDay[] }) {
  const days = rows.length
  const withFast = rows.filter((row) => row.hours !== null)
  const met = withFast.filter((row) => row.met).length
  const tickWidth = days <= 7 ? 22 : days <= 30 ? 8 : 4
  // Keep a visible gap between bars on back-to-back days; at 90 days a pixel is all there is room for.
  const barGap = days <= 7 ? '35%' : days <= 30 ? 2 : 1

  return (
    <div>
      <ul className="analytics-legend">
        <li>
          <span className="analytics-legend-swatch" style={{ background: 'var(--fasting-ring)' }} />
          Hours fasted
        </li>
        <li>
          <span className="fasting-legend-goal" />
          Goal
        </li>
      </ul>
      <div
        className="analytics-chart"
        role="img"
        aria-label={`Hours fasted per day over the last ${days} days: ${withFast.length} ${withFast.length === 1 ? 'day' : 'days'} with a fast, ${met} of them met the goal.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={barGap}>
            <CartesianGrid vertical={false} stroke="var(--divider)" />
            <XAxis
              dataKey="day"
              tickFormatter={(value) => formatTick(String(value), days)}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tick={axisTick}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              width={40}
              allowDecimals={false}
              tickFormatter={(value: number) => `${value}h`}
              domain={[0, (max: number) => Math.max(16, Math.ceil(max / 4) * 4)]}
            />
            <Tooltip cursor={{ fill: 'var(--ring-track)' }} content={<DayTooltip />} />
            <Bar
              dataKey="hours"
              fill="var(--fasting-ring)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
            <Scatter
              dataKey="goalHours"
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number }) => <GoalTick cx={props.cx} cy={props.cy} width={tickWidth} />}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function GoalTick({ cx, cy, width }: { cx?: number; cy?: number; width: number }) {
  if (cx === undefined || cy === undefined || !Number.isFinite(cx) || !Number.isFinite(cy)) return <g />
  return (
    <line
      x1={cx - width / 2}
      x2={cx + width / 2}
      y1={cy}
      y2={cy}
      stroke="var(--text-secondary)"
      strokeWidth={2}
      strokeLinecap="round"
    />
  )
}

interface TooltipProps {
  active?: boolean
  payload?: { payload?: FastingDay }[]
}

function DayTooltip({ active, payload }: TooltipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div style={tooltipStyle}>
      <strong style={{ display: 'block', marginBottom: 2 }}>{formatLongDay(row.day)}</strong>
      {row.hours === null ? (
        <span style={{ color: 'var(--text-secondary)' }}>No fast ended this day</span>
      ) : (
        <>
          <span style={{ display: 'block' }}>
            {formatHours(row.hours)} fasted{row.fasts > 1 ? ` across ${row.fasts} fasts` : ''}
          </span>
          <span style={{ display: 'block', color: 'var(--text-secondary)' }}>
            Goal {formatHours(row.goalHours ?? 0)} · {row.met ? 'met' : 'missed'}
          </span>
        </>
      )}
    </div>
  )
}

function formatHours(hours: number): string {
  const whole = Math.floor(hours)
  const minutes = Math.round((hours - whole) * 60)
  return minutes === 0 ? `${whole}h` : `${whole}h ${minutes}m`
}

function toDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatTick(day: string, days: number): string {
  const date = toDate(day)
  return days <= 7
    ? date.toLocaleDateString([], { weekday: 'short' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatLongDay(day: string): string {
  return toDate(day).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

const axisTick = { fill: 'var(--text-tertiary)', fontSize: 12 }

const tooltipStyle = {
  padding: '8px 10px',
  border: '1px solid var(--divider)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--paper-bright)',
  boxShadow: 'var(--shadow-card)',
  color: 'var(--text-primary)',
  fontSize: 12,
}
