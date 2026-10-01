import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface ChartSeries {
  dataKey: string
  label: string
  color: string
}

interface AnalyticsChartProps {
  data: Record<string, string | number | null>[]
  xKey: string
  series: ChartSeries[]
  ariaLabel: string
  valueFormatter?: (value: number, dataKey: string) => string
  xTickFormatter?: (value: string) => string
  tooltipLabelFormatter?: (value: string) => string
}

interface AnalyticsLineChartProps extends AnalyticsChartProps {
  referenceLine?: { value: number; label: string }
}

interface AnalyticsBarChartProps extends AnalyticsChartProps {
  stacked?: boolean
}

export function AnalyticsLineChart({
  data,
  xKey,
  series,
  ariaLabel,
  valueFormatter = defaultValueFormatter,
  xTickFormatter = formatChartDate,
  tooltipLabelFormatter = formatLongDate,
  referenceLine,
}: AnalyticsLineChartProps) {
  return (
    <>
      <ChartLegend series={series} referenceLine={referenceLine} />
      <div className="analytics-chart" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--divider)" />
            <XAxis
              dataKey={xKey}
              tickFormatter={(value) => xTickFormatter(String(value))}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tick={axisTick}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              width={48}
              domain={['auto', 'auto']}
            />
            <Tooltip
              labelFormatter={(label) => tooltipLabelFormatter(String(label))}
              formatter={(value, name) => [
                valueFormatter(Number(value), String(name)),
                series.find((item) => item.dataKey === name)?.label ?? String(name),
              ]}
              contentStyle={tooltipStyle}
            />
            {referenceLine && (
              <ReferenceLine
                y={referenceLine.value}
                stroke="var(--text-tertiary)"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
            )}
            {series.map((item) => (
              <Line
                key={item.dataKey}
                type="monotone"
                dataKey={item.dataKey}
                name={item.dataKey}
                stroke={item.color}
                strokeWidth={2.5}
                dot={data.length <= 12 ? { r: 3, strokeWidth: 0 } : false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

export function AnalyticsBarChart({
  data,
  xKey,
  series,
  ariaLabel,
  valueFormatter = defaultValueFormatter,
  xTickFormatter = formatChartDate,
  tooltipLabelFormatter = formatLongDate,
  stacked = false,
}: AnalyticsBarChartProps) {
  return (
    <>
      <ChartLegend series={series} />
      <div className="analytics-chart" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--divider)" />
            <XAxis
              dataKey={xKey}
              tickFormatter={(value) => xTickFormatter(String(value))}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tick={axisTick}
            />
            <YAxis tickLine={false} axisLine={false} tick={axisTick} width={48} />
            <Tooltip
              labelFormatter={(label) => tooltipLabelFormatter(String(label))}
              formatter={(value, name) => [
                valueFormatter(Number(value), String(name)),
                series.find((item) => item.dataKey === name)?.label ?? String(name),
              ]}
              contentStyle={tooltipStyle}
            />
            {series.map((item, index) => (
              <Bar
                key={item.dataKey}
                dataKey={item.dataKey}
                name={item.dataKey}
                fill={item.color}
                stackId={stacked ? 'stack' : undefined}
                stroke={stacked ? 'var(--paper-bright)' : undefined}
                strokeWidth={stacked ? 1 : 0}
                radius={
                  !stacked || index === series.length - 1 ? [5, 5, 0, 0] : 0
                }
                maxBarSize={32}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
function ChartLegend({
  series,
  referenceLine,
}: {
  series: ChartSeries[]
  referenceLine?: { label: string }
}) {
  if (series.length < 2 && !referenceLine) return null
  return (
    <ul className="analytics-legend">
      {series.map((item) => (
        <li key={item.dataKey}>
          <span className="analytics-legend-swatch" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
      {referenceLine && (
        <li>
          <span className="analytics-legend-swatch dashed" />
          {referenceLine.label}
        </li>
      )}
    </ul>
  )
}

function formatChartDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })
}

function formatLongDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function defaultValueFormatter(value: number): string {
  return Math.round(value).toLocaleString()
}

const axisTick = {
  fill: 'var(--text-tertiary)',
  fontSize: 10,
}

const tooltipStyle = {
  border: '1px solid var(--divider)',
  borderRadius: 12,
  background: 'var(--paper-bright)',
  boxShadow: 'var(--shadow-card)',
  color: 'var(--text-primary)',
  fontSize: 12,
}
