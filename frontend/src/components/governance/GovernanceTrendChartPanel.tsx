import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { reportDashboardChartColor } from '../../lib/reportChartTheme'
import type { GovernanceTrendChartItem } from '../../lib/governanceTrendCharts'

const CHART_HEIGHT = 300

function EmptyTrend() {
  return (
    <p className="muted reporting-dashboard__chart-empty">
      No total data for this indicator yet.
    </p>
  )
}

function shapeLabelFor(shapeId: GovernanceTrendChartItem['shapeId']): string {
  switch (shapeId) {
    case 'line':
      return 'Line'
    case 'bar':
      return 'Bar'
    case 'pie':
      return 'Pie'
    case 'area':
      return 'Area'
    case 'step':
      return 'Step'
    case 'composed':
      return 'Composed'
    default:
      return 'Trend'
  }
}

export function GovernanceTrendChartPanel({ item }: { item: GovernanceTrendChartItem }) {
  const color = reportDashboardChartColor(item.colorIndex)
  const empty = item.points.every((p) => p.total === 0)
  const shapeLabel = shapeLabelFor(item.shapeId)
  const pieData = item.points.filter((p) => p.total > 0)

  return (
    <div className="report-generator__chart-panel reporting-dashboard__panel governance-dashboard__chart-panel">
      <h4 className="chart-caption" title={item.indicatorLabel}>
        {item.indicatorLabel}
        <span className="governance-dashboard__chart-shape-tag">{shapeLabel}</span>
      </h4>
      {empty ? (
        <EmptyTrend />
      ) : (
        <div className="governance-dashboard__chart-canvas">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {item.shapeId === 'bar' ? (
              <BarChart data={item.points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} width={40} />
                <Tooltip />
                <Bar dataKey="total" name="Total" fill={color} radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : item.shapeId === 'pie' ? (
              <PieChart margin={{ left: 4, right: 4, top: 8, bottom: 8 }}>
                <Tooltip />
                <Pie
                  data={pieData.length > 0 ? pieData : item.points}
                  dataKey="total"
                  nameKey="year"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(props) => {
                    const year = String(props.name ?? '')
                    const total = Number(props.value ?? 0)
                    return `${year}: ${total}`
                  }}
                >
                  {(pieData.length > 0 ? pieData : item.points).map((point, idx) => (
                    <Cell
                      key={point.yearId}
                      fill={reportDashboardChartColor(item.colorIndex + idx)}
                    />
                  ))}
                </Pie>
              </PieChart>
            ) : item.shapeId === 'area' ? (
              <AreaChart data={item.points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} width={40} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total"
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
                  name="Total"
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
                <Bar dataKey="total" name="Total" fill={color} fillOpacity={0.35} radius={[4, 4, 0, 0]} />
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
                  name="Total"
                  stroke={color}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
