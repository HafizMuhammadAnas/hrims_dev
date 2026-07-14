import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  IndicatorDimensionTotalsSeries,
  IndicatorTrendSeries,
} from '../../lib/governanceDashboardData'
import {
  buildComparisonPoints,
  type ResolvedPrefixedChart,
} from '../../lib/governancePrefixedCharts'
import { reportDashboardChartColor } from '../../lib/reportChartTheme'
import type { GovernanceTrendChartShapeId } from '../../lib/governanceTrendCharts'

const CHART_HEIGHT = 300

function EmptyTrend({ message }: { message?: string }) {
  return (
    <p className="muted reporting-dashboard__chart-empty">
      {message ?? 'No total data for this indicator yet.'}
    </p>
  )
}

function shapeTag(shape: string): string {
  return shape.charAt(0).toUpperCase() + shape.slice(1)
}

function TrendShapeChart({
  shape,
  points,
  colorIndex,
}: {
  shape: GovernanceTrendChartShapeId
  points: Array<{ yearId: string; year: string; total: number }>
  colorIndex: number
}) {
  const color = reportDashboardChartColor(colorIndex)
  const empty = points.every((p) => p.total === 0)
  if (empty) return <EmptyTrend />

  const pieData = points.filter((p) => p.total > 0)

  return (
    <div className="governance-dashboard__chart-canvas">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        {shape === 'bar' ? (
          <BarChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="year" />
            <YAxis allowDecimals={false} width={40} />
            <Tooltip />
            <Bar dataKey="total" name="Total" fill={color} radius={[6, 6, 0, 0]} />
          </BarChart>
        ) : shape === 'pie' ? (
          <PieChart margin={{ left: 4, right: 4, top: 8, bottom: 8 }}>
            <Tooltip />
            <Pie
              data={pieData.length > 0 ? pieData : points}
              dataKey="total"
              nameKey="year"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={(props) => `${String(props.name ?? '')}: ${Number(props.value ?? 0)}`}
            >
              {(pieData.length > 0 ? pieData : points).map((point, idx) => (
                <Cell key={point.yearId} fill={reportDashboardChartColor(colorIndex + idx)} />
              ))}
            </Pie>
          </PieChart>
        ) : shape === 'area' ? (
          <AreaChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
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
        ) : shape === 'step' ? (
          <LineChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
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
        ) : shape === 'composed' ? (
          <ComposedChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="year" />
            <YAxis allowDecimals={false} width={40} />
            <Tooltip />
            <Bar dataKey="total" name="Total" fill={color} fillOpacity={0.35} radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="total" name="Trend" stroke={color} strokeWidth={3} dot={{ r: 4 }} />
          </ComposedChart>
        ) : (
          <LineChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
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
  )
}

function ComparisonChart({
  chart,
  seriesById,
  colorIndex,
}: {
  chart: Extract<ResolvedPrefixedChart, { kind: 'comparison' }>
  seriesById: Map<string, IndicatorTrendSeries>
  colorIndex: number
}) {
  const a = chart.series[0]
  const b = chart.series[1]
  const seriesA = a.indicator ? seriesById.get(String(a.indicator.id)) ?? null : null
  const seriesB = b.indicator ? seriesById.get(String(b.indicator.id)) ?? null : null
  const points = buildComparisonPoints(seriesA, seriesB, a.key, b.key)
  const empty =
    !a.indicator ||
    !b.indicator ||
    points.length === 0 ||
    points.every((p) => Number(p[a.key] ?? 0) === 0 && Number(p[b.key] ?? 0) === 0)

  const colorA = reportDashboardChartColor(colorIndex)
  const colorB = reportDashboardChartColor(colorIndex + 1)

  return (
    <div className="report-generator__chart-panel reporting-dashboard__panel governance-dashboard__chart-panel">
      <h4 className="chart-caption" title={chart.title}>
        {chart.title}
        <span className="governance-dashboard__chart-shape-tag">
          Comparison · {shapeTag(chart.shape)}
        </span>
      </h4>
      {!a.indicator || !b.indicator ? (
        <EmptyTrend message="Selected indicator was not found in the catalog." />
      ) : empty ? (
        <EmptyTrend />
      ) : (
        <div className="governance-dashboard__chart-canvas">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {chart.shape === 'bar' ? (
              <BarChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} width={40} />
                <Tooltip />
                <Legend />
                <Bar dataKey={a.key} name={a.label} fill={colorA} radius={[4, 4, 0, 0]} />
                <Bar dataKey={b.key} name={b.label} fill={colorB} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : chart.shape === 'composed' ? (
              <ComposedChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} width={40} />
                <Tooltip />
                <Legend />
                <Bar dataKey={a.key} name={a.label} fill={colorA} fillOpacity={0.35} radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey={b.key}
                  name={b.label}
                  stroke={colorB}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            ) : (
              <LineChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} width={40} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={a.key}
                  name={a.label}
                  stroke={colorA}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey={b.key}
                  name={b.label}
                  stroke={colorB}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function TrendChart({
  chart,
  seriesById,
  colorIndex,
}: {
  chart: Extract<ResolvedPrefixedChart, { kind: 'trend' }>
  seriesById: Map<string, IndicatorTrendSeries>
  colorIndex: number
}) {
  const slot = chart.series[0]
  const series = slot.indicator ? seriesById.get(String(slot.indicator.id)) : null

  return (
    <div className="report-generator__chart-panel reporting-dashboard__panel governance-dashboard__chart-panel">
      <h4 className="chart-caption" title={chart.title}>
        {chart.title}
        <span className="governance-dashboard__chart-shape-tag">{shapeTag(chart.shape)}</span>
      </h4>
      {!slot.indicator ? (
        <EmptyTrend message="Selected indicator was not found in the catalog." />
      ) : (
        <TrendShapeChart
          shape={chart.shape}
          points={series?.points ?? []}
          colorIndex={colorIndex}
        />
      )}
    </div>
  )
}

function DimensionTotalsChart({
  chart,
  dimensionSeriesById,
  colorIndex,
}: {
  chart: Extract<ResolvedPrefixedChart, { kind: 'dimension_totals' }>
  dimensionSeriesById: Map<string, IndicatorDimensionTotalsSeries>
  colorIndex: number
}) {
  const slot = chart.series[0]
  const series = slot.indicator
    ? dimensionSeriesById.get(String(slot.indicator.id)) ?? null
    : null
  const dimensions = series?.dimensions ?? []
  const points = series?.points ?? []
  const empty =
    !slot.indicator ||
    dimensions.length === 0 ||
    points.length === 0 ||
    points.every((p) => dimensions.every((d) => Number(p[d.key] ?? 0) === 0))

  return (
    <div className="report-generator__chart-panel reporting-dashboard__panel governance-dashboard__chart-panel">
      <h4 className="chart-caption" title={chart.title}>
        {chart.title}
        <span className="governance-dashboard__chart-shape-tag">
          Dimensions · {shapeTag(chart.shape)}
        </span>
      </h4>
      {!slot.indicator ? (
        <EmptyTrend message="Selected indicator was not found in the catalog." />
      ) : empty ? (
        <EmptyTrend message="No dimension year totals found for this indicator yet." />
      ) : (
        <div className="governance-dashboard__chart-canvas">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {chart.shape === 'bar' ? (
              <BarChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} width={40} />
                <Tooltip />
                <Legend />
                {dimensions.map((dim, i) => (
                  <Bar
                    key={dim.key}
                    dataKey={dim.key}
                    name={dim.label}
                    fill={reportDashboardChartColor(colorIndex + i)}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            ) : chart.shape === 'composed' ? (
              <ComposedChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} width={40} />
                <Tooltip />
                <Legend />
                {dimensions.map((dim, i) =>
                  i === 0 ? (
                    <Bar
                      key={dim.key}
                      dataKey={dim.key}
                      name={dim.label}
                      fill={reportDashboardChartColor(colorIndex + i)}
                      fillOpacity={0.35}
                      radius={[4, 4, 0, 0]}
                    />
                  ) : (
                    <Line
                      key={dim.key}
                      type="monotone"
                      dataKey={dim.key}
                      name={dim.label}
                      stroke={reportDashboardChartColor(colorIndex + i)}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  ),
                )}
              </ComposedChart>
            ) : (
              <LineChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} width={40} />
                <Tooltip />
                <Legend />
                {dimensions.map((dim, i) => (
                  <Line
                    key={dim.key}
                    type="monotone"
                    dataKey={dim.key}
                    name={dim.label}
                    stroke={reportDashboardChartColor(colorIndex + i)}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

type Props = {
  charts: ResolvedPrefixedChart[]
  seriesById: Map<string, IndicatorTrendSeries>
  dimensionSeriesById?: Map<string, IndicatorDimensionTotalsSeries>
  loading?: boolean
}

/** Default governance graphs (mode 2) — fixed indicators, 2 equal cards per row. */
export function GovernancePrefixedChartsSection({
  charts,
  seriesById,
  dimensionSeriesById,
  loading,
}: Props) {
  const dimMap = dimensionSeriesById ?? new Map()
  const rows: ResolvedPrefixedChart[][] = []
  for (let i = 0; i < charts.length; i += 2) {
    rows.push(charts.slice(i, i + 2))
  }

  return (
    <div className="report-generator__results report-generator__results--full reporting-dashboard">
      <h3 className="cat-static-trend-dashboard__title">Indicator Trends</h3>
      {loading ? (
        <p className="muted">Loading default trend charts…</p>
      ) : (
        <div className="governance-dashboard__chart-rows">
          {rows.map((row, rowIndex) => (
            <div key={`prefixed-row-${rowIndex}`} className="governance-dashboard__chart-row">
              {row.map((chart, colIndex) => {
                const colorIndex = rowIndex * 2 + colIndex
                if (chart.kind === 'comparison') {
                  return (
                    <ComparisonChart
                      key={chart.key}
                      chart={chart}
                      seriesById={seriesById}
                      colorIndex={colorIndex}
                    />
                  )
                }
                if (chart.kind === 'dimension_totals') {
                  return (
                    <DimensionTotalsChart
                      key={chart.key}
                      chart={chart}
                      dimensionSeriesById={dimMap}
                      colorIndex={colorIndex}
                    />
                  )
                }
                return (
                  <TrendChart
                    key={chart.key}
                    chart={chart}
                    seriesById={seriesById}
                    colorIndex={colorIndex}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
