/** Tiny trend line for the latest entries (oldest → newest). */
export const SPARK_POINTS = 14
const SPARK_W = 128
const SPARK_H = 52
const SPARK_PAD = 5

export function Sparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const innerW = SPARK_W - SPARK_PAD * 2
  const innerH = SPARK_H - SPARK_PAD * 2
  const points = values.map((v, i) => {
    const x = SPARK_PAD + (i * innerW) / (values.length - 1)
    const y = SPARK_PAD + (span === 0 ? innerH / 2 : (1 - (v - min) / span) * innerH)
    return [x, y] as const
  })
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${SPARK_PAD},${SPARK_H} ${line} ${SPARK_W - SPARK_PAD},${SPARK_H}`
  const [lastX, lastY] = points[points.length - 1]
  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      role="img"
      aria-label={label}
      style={{ flex: 'none', overflow: 'visible' }}
    >
      <polygon points={area} fill={color} fillOpacity={0.1} stroke="none" />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={3.5} fill={color} stroke="var(--card-bg)" strokeWidth={1.5} />
    </svg>
  )
}

/** Text button that expands a capped history list. */
export function ShowAllButton({ expanded, total, onToggle }: { expanded: boolean; total: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="text-button"
      style={{ marginTop: 'var(--space-xs)' }}
    >
      {expanded ? 'Show less' : `Show all ${total}`}
    </button>
  )
}
