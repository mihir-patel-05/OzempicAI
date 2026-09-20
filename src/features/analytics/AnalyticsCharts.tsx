import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
}

export function AnalyticsLineChart({
  data,
  xKey,
  series,
  ariaLabel,
  valueFormatter = defaultValueFormatter,
}: AnalyticsChartProps) {
  return (
    <div className="analytics-chart" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="var(--divider)" />
          <XAxis
            dataKey={xKey}
            tickFormatter={formatChartDate}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tick={axisTick}
          />
          <YAxis tickLine={false} axisLine={false} tick={axisTick} width={48} />
          <Tooltip
            labelFormatter={(label) => formatLongDate(String(label))}
            formatter={(value, name) => [
              valueFormatter(Number(value), String(name)),
              series.find((item) => item.dataKey === name)?.label ?? String(name),
            ]}
            contentStyle={tooltipStyle}
          />
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
  )
}

export function AnalyticsBarChart({
  data,
  xKey,
  series,
  ariaLabel,
  valueFormatter = defaultValueFormatter,
}: AnalyticsChartProps) {
  return (
    <div className="analytics-chart" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="var(--divider)" />
          <XAxis
            dataKey={xKey}
            tickFormatter={formatChartDate}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tick={axisTick}
          />
          <YAxis tickLine={false} axisLine={false} tick={axisTick} width={48} />
          <Tooltip
            labelFormatter={(label) => formatLongDate(String(label))}
            formatter={(value, name) => [
              valueFormatter(Number(value), String(name)),
              series.find((item) => item.dataKey === name)?.label ?? String(name),
            ]}
            contentStyle={tooltipStyle}
          />
          {series.map((item) => (
            <Bar
              key={item.dataKey}
              dataKey={item.dataKey}
              name={item.dataKey}
              fill={item.color}
              radius={[5, 5, 0, 0]}
              maxBarSize={32}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
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

