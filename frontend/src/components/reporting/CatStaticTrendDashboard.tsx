import type { ReactNode } from 'react'
import {
  CartesianGrid,
  Cell,
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
import {
  CAT_COMPLAINTS_RECEIVED_INVESTIGATED,
  CAT_CUSTODIAL_RAPE_CASES,
  CAT_OFFICERS_PROSECUTED_CONVICTED,
  CAT_TORTURE_COMPLAINTS_REGISTERED,
  CAT_TORTURE_PIE_COLORS,
} from '../../data/catStaticTrendCharts'

function ChartPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="report-generator__chart-panel reporting-dashboard__panel cat-static-trend-dashboard__panel">
      <h4 className="chart-caption">{title}</h4>
      {subtitle ? <p className="cat-static-trend-dashboard__subtitle">{subtitle}</p> : null}
      {children}
    </div>
  )
}

export function CatStaticTrendDashboard() {
  return (
    <section className="cat-static-trend-dashboard" aria-labelledby="cat-static-trend-title">
      <h3 id="cat-static-trend-title" className="cat-static-trend-dashboard__title">
        Trend Analysis
      </h3>
      <p className="muted text-compact cat-static-trend-dashboard__lead">
        Reference trend charts for CAT reporting (static national indicators, 2021–2025).
      </p>

      <div className="reporting-dashboard__row reporting-dashboard__row--top cat-static-trend-dashboard__row">
        <ChartPanel title="Superior Officers Prosecuted vs. Convicted (2021–2025)">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={[...CAT_OFFICERS_PROSECUTED_CONVICTED]} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="prosecuted"
                name="Officers Prosecuted"
                stroke="#2980b9"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="convicted"
                name="Officers Convicted"
                stroke="#e67e22"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Custodial Rape Cases Reported (2021–2025)">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={[...CAT_CUSTODIAL_RAPE_CASES]} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="cases"
                name="Custodial Rape Cases Reported"
                stroke="#c0392b"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="reporting-dashboard__row reporting-dashboard__row--top cat-static-trend-dashboard__row">
        <ChartPanel title="Number of Torture Complaints Registered (Act 2022)">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={[...CAT_TORTURE_COMPLAINTS_REGISTERED]}
                dataKey="value"
                nameKey="year"
                cx="50%"
                cy="50%"
                outerRadius={110}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {CAT_TORTURE_COMPLAINTS_REGISTERED.map((_, index) => (
                  <Cell key={CAT_TORTURE_COMPLAINTS_REGISTERED[index].year} fill={CAT_TORTURE_PIE_COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Torture Complaints: Received vs. Investigated (2021–2025)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={[...CAT_COMPLAINTS_RECEIVED_INVESTIGATED]}
              margin={{ left: 4, right: 8, top: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line
                type="linear"
                dataKey="received"
                name="Complaints Received"
                stroke="#0284c7"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
              <Line
                type="linear"
                dataKey="investigated"
                name="Complaints Investigated"
                stroke="#d97706"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <table className="data-table cat-static-trend-dashboard__table">
            <thead>
              <tr>
                <th>Indicator</th>
                <th>2021</th>
                <th>2022</th>
                <th>2023</th>
                <th>2024</th>
                <th>2025</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span className="cat-static-trend-dashboard__badge cat-static-trend-dashboard__badge--received" />
                  <strong>Complaints Received</strong>
                </td>
                {CAT_COMPLAINTS_RECEIVED_INVESTIGATED.map((row) => (
                  <td key={`r-${row.year}`}>{row.received}</td>
                ))}
              </tr>
              <tr>
                <td>
                  <span className="cat-static-trend-dashboard__badge cat-static-trend-dashboard__badge--investigated" />
                  <strong>Complaints Investigated</strong>
                </td>
                {CAT_COMPLAINTS_RECEIVED_INVESTIGATED.map((row) => (
                  <td key={`i-${row.year}`}>{row.investigated}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </ChartPanel>
      </div>
    </section>
  )
}
