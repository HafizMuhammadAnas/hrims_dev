import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { reportDashboardChartColor } from '../../lib/reportChartTheme'
import type { GovernanceTrendChartItem } from '../../lib/governanceTrendCharts'

function EmptyTrend() {
  return (
    <p className="muted reporting-dashboard__chart-empty">
      No gender total data for this indicator yet.
    </p>
  )
}

export function GovernanceTrendChartPanel({ item }: { item: GovernanceTrendChartItem }) {
  const color = reportDashboardChartColor(item.colorIndex)
  const empty = item.points.every((p) => p.total === 0)
  const shapeLabel =
    item.shapeId === 'line'
      ? 'Line'
      : item.shapeId === 'bar'
        ? 'Bar'
        : item.shapeId === 'area'
          ? 'Area'
          : item.shapeId === 'step'
            ? 'Step'
            : 'Composed'

  return (
    <div
      className="report-generator__chart-panel reporting-dashboard__panel governance-dashboard__chart-panel"
      style={{ gridColumn: `span ${Math.round(item.renderSpan)}` }}
    >
      <h4 className="chart-caption" title={item.indicatorLabel}>
        {item.indicatorLabel}
        <span className="governance-dashboard__chart-shape-tag">{shapeLabel}</span>
      </h4>
      {empty ? (
        <EmptyTrend />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          {item.shapeId === 'bar' ? (
            <BarChart data={item.points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} width={40} />
              <Tooltip />
              <Bar dataKey="total" name="Gender total" fill={color} radius={[6, 6, 0, 0]} />
            </BarChart>
          ) : item.shapeId === 'area' ? (
            <AreaChart data={item.points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} width={40} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="total"
                name="Gender total"
                stroke={color}
                fill={color}
                fillOpacity={0.28}
                strokeWidth={2.5}
              />
            </AreaChart>
          ) : item.shapeId === 'step' ? (
            <LineChart data={item.points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} width={40} />
              <Tooltip />
              <Line
                type="stepAfter"
                dataKey="total"
                name="Gender total"
                stroke={color}
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          ) : item.shapeId === 'composed' ? (
            <ComposedChart data={item.points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} width={40} />
              <Tooltip />
              <Bar dataKey="total" name="Gender total" fill={color} fillOpacity={0.35} radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="total"
                name="Trend"
                stroke={color}
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </ComposedChart>
          ) : (
            <LineChart data={item.points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} width={40} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="total"
                name="Gender total"
                stroke={color}
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  )
}
