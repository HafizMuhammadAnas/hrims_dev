import { useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CAT_TRACKER_CUSTODIAL_DEATHS,
  CAT_TRACKER_ENFORCED_DISAPPEARANCES,
  CAT_TRACKER_GBV,
  CAT_TRACKER_LOG_DATA,
  CAT_TRACKER_LOG_YEARS,
  CAT_TRACKER_OVERVIEW,
  CAT_TRACKER_PRISON_OCCUPANCY,
  CAT_TRACKER_PROGRESS_FILTERS,
  CAT_TRACKER_SUBTABS,
  CAT_TRACKER_TORTURE_PROSECUTIONS,
  CAT_TRACKER_YEAR_KEYS,
  catTrackerProgressBadgeClass,
  catTrackerProgressLabel,
  type CatTrackerLogRow,
  type CatTrackerSubtab,
} from '../../data/catTrackerData'
import { KnowledgeHubPanel } from './KnowledgeHubUi'

function TrackerSubtabs({
  active,
  onChange,
}: {
  active: CatTrackerSubtab
  onChange: (tab: CatTrackerSubtab) => void
}) {
  return (
    <div className="cat-tracker-subtabs" role="tablist" aria-label="CAT Tracker views">
      {CAT_TRACKER_SUBTABS.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          className={`cat-tracker-subtabs__btn${active === tab ? ' cat-tracker-subtabs__btn--active' : ''}`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

function LogYearCell({ value }: { value: string }) {
  return <td>{value || ''}</td>
}

function LogTableRow({ row }: { row: CatTrackerLogRow }) {
  return (
    <tr>
      <td>
        <strong>{row.id}</strong>
      </td>
      <td>
        <strong>{row.metric}</strong>
      </td>
      <td>{row.unit}</td>
      {CAT_TRACKER_YEAR_KEYS.map((key) => (
        <LogYearCell key={key} value={row[key]} />
      ))}
      <td>
        <span className={catTrackerProgressBadgeClass(row.progress)}>
          {catTrackerProgressLabel(row.progress)}
        </span>
      </td>
      <td>{row.source}</td>
    </tr>
  )
}

function FullQuantitativeLogView() {
  const [search, setSearch] = useState('')
  const [progressFilter, setProgressFilter] = useState('ALL')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return CAT_TRACKER_LOG_DATA.filter((row) => {
      const matchesFilter = progressFilter === 'ALL' || row.progress.includes(progressFilter)
      if (!matchesFilter) return false
      if (!q) return true
      return JSON.stringify(row).toLowerCase().includes(q)
    })
  }, [search, progressFilter])

  return (
    <KnowledgeHubPanel title="Full Quantitative Data Log — Row 90 Onwards (Complete 84-Metric Dataset)">
      <div className="cat-tracker-controls">
        <input
          type="search"
          className="cat-tracker-search"
          placeholder="Search metric, ID, unit, or source..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search CAT tracker metrics"
        />
        <select
          className="cat-tracker-select"
          value={progressFilter}
          onChange={(e) => setProgressFilter(e.target.value)}
          aria-label="Filter by progress type"
        >
          {CAT_TRACKER_PROGRESS_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="cat-tracker-counter">
          Showing {filtered.length} of {CAT_TRACKER_LOG_DATA.length} rows
        </div>
      </div>
      <div className="cat-tracker-table-wrap">
        <table className="data-table cat-tracker-log-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Metric Name</th>
              <th>Unit</th>
              {CAT_TRACKER_LOG_YEARS.map((year) => (
                <th key={year}>{year}</th>
              ))}
              <th>Progress Status</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => (
              <LogTableRow key={`${row.id}-${row.metric}-${idx}`} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </KnowledgeHubPanel>
  )
}

function FlagshipCard({
  title,
  note,
  table,
  chart,
}: {
  title: string
  note?: string
  table: ReactNode
  chart: ReactNode
}) {
  return (
    <div className="cat-tracker-flagship-card">
      <h3 className="cat-tracker-flagship-card__title">{title}</h3>
      <div className="cat-tracker-flagship-card__grid">
        <div className="cat-tracker-table-wrap cat-tracker-table-wrap--compact">{table}</div>
        <div className="cat-tracker-chart">{chart}</div>
      </div>
      {note ? <p className="cat-tracker-note">{note}</p> : null}
    </div>
  )
}

function FlagshipSummaryView() {
  const prisonChartData = CAT_TRACKER_PRISON_OCCUPANCY.filter((row) => row.province !== 'National Total')

  return (
    <div className="cat-tracker-flagship">
      <FlagshipCard
        title="1. Torture Act Prosecutions (2022 Act), 2019–2025"
        table={
          <table className="data-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Cases Sent</th>
                <th>Convictions</th>
                <th>Acquittals</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>
              {CAT_TRACKER_TORTURE_PROSECUTIONS.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td>{row.sent}</td>
                  <td>{row.convictions}</td>
                  <td>{row.acquittals}</td>
                  <td>{row.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
        chart={
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={[...CAT_TRACKER_TORTURE_PROSECUTIONS]} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sent" name="Cases Sent" fill="#0284c7" />
              <Bar dataKey="convictions" name="Convictions" fill="#10b981" />
              <Bar dataKey="acquittals" name="Acquittals" fill="#ef4444" />
              <Bar dataKey="pending" name="Pending" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        }
      />

      <FlagshipCard
        title="2. Enforced Disappearances — Commission of Inquiry, 2019–2025"
        note="2025 is partial. 0 convictions reported across any year in this series."
        table={
          <table className="data-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Cases Received</th>
                <th>Cases Disposed</th>
              </tr>
            </thead>
            <tbody>
              {CAT_TRACKER_ENFORCED_DISAPPEARANCES.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td>{row.received}</td>
                  <td>{row.disposed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
        chart={
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={[...CAT_TRACKER_ENFORCED_DISAPPEARANCES]} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="received"
                name="Cases Received"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="disposed"
                name="Cases Disposed"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        }
      />

      <FlagshipCard
        title="3. Custodial Deaths by Province, 2019–2024"
        table={
          <table className="data-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Sindh (Male)</th>
                <th>KP (Male)</th>
                <th>Punjab (Total)</th>
              </tr>
            </thead>
            <tbody>
              {CAT_TRACKER_CUSTODIAL_DEATHS.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td>{row.sindhMale}</td>
                  <td>{row.kpMale}</td>
                  <td>{row.punjabTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
        chart={
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={[...CAT_TRACKER_CUSTODIAL_DEATHS]} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="punjabTotal"
                name="Punjab Total"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="sindhMale"
                name="Sindh (Male)"
                stroke="#0284c7"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="kpMale"
                name="KP (Male)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        }
      />

      <FlagshipCard
        title="4. Prison Occupancy by Province (2025 Snapshot)"
        table={
          <table className="data-table">
            <thead>
              <tr>
                <th>Province</th>
                <th>Capacity</th>
                <th>Population</th>
                <th>Occupancy %</th>
              </tr>
            </thead>
            <tbody>
              {CAT_TRACKER_PRISON_OCCUPANCY.map((row) => (
                <tr key={row.province}>
                  <td>
                    {row.province === 'National Total' ? <strong>{row.province}</strong> : row.province}
                  </td>
                  <td>{row.province === 'National Total' ? <strong>{row.capacity}</strong> : row.capacity}</td>
                  <td>{row.province === 'National Total' ? <strong>{row.population}</strong> : row.population}</td>
                  <td>{row.province === 'National Total' ? <strong>{row.occupancy}</strong> : row.occupancy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
        chart={
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={prisonChartData} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="province" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="capacity" name="Capacity" fill="#94a3b8" />
              <Bar dataKey="population" name="Population" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        }
      />

      <FlagshipCard
        title="5. Gender-Based Violence: Cases Registered vs. Convictions, 2022–2025"
        note="Overall conviction rate: ~2.5% (251 convictions / 10,004 cases)."
        table={
          <table className="data-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Cases Registered</th>
                <th>Convictions</th>
              </tr>
            </thead>
            <tbody>
              {CAT_TRACKER_GBV.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td>{row.registered}</td>
                  <td>{row.convictions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
        chart={
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={[...CAT_TRACKER_GBV]} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="registered" name="Cases Registered" fill="#0284c7" />
              <Bar dataKey="convictions" name="Convictions" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        }
      />
    </div>
  )
}

function OverviewGraphView() {
  return (
    <KnowledgeHubPanel title="Multi-Metric Time Series Visualizer (Overlay of Key Series)">
      <p className="muted text-compact cat-tracker-overview-lead">
        Comparative view of high-volume annual metrics tracked across Pakistan&apos;s CAT reporting cycles.
      </p>
      <div className="cat-tracker-chart cat-tracker-chart--tall">
        <ResponsiveContainer width="100%" height={480}>
          <LineChart data={[...CAT_TRACKER_OVERVIEW]} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="year" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="disappearancesReceived"
              name="Enforced Disappearances Received"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="punjabCustodialDeaths"
              name="Punjab Custodial Deaths"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="tortureCasesSent"
              name="Torture Act Cases Sent to Court"
              stroke="#0284c7"
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="vawRegistered"
              name="VAW Cases Registered"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </KnowledgeHubPanel>
  )
}

export function CatTrackerTab() {
  const [activeSubtab, setActiveSubtab] = useState<CatTrackerSubtab>(CAT_TRACKER_SUBTABS[0])

  return (
    <section className="cat-tracker" aria-labelledby="cat-tracker-heading">
      <div className="cat-tracker-header">
        <h2 id="cat-tracker-heading" className="cat-tracker-header__title">
          Pakistan CAT Compliance: Master Quantitative Tracker
        </h2>
        <p className="muted text-compact cat-tracker-header__subtitle">
          Complete Dataset &amp; Visualizations: All 5 Summary Tables + Complete Row 90+ Data Log (All 84 Rows
          Included)
        </p>
      </div>

      <TrackerSubtabs active={activeSubtab} onChange={setActiveSubtab} />

      {activeSubtab === CAT_TRACKER_SUBTABS[0] ? <FullQuantitativeLogView /> : null}
      {activeSubtab === CAT_TRACKER_SUBTABS[1] ? <FlagshipSummaryView /> : null}
      {activeSubtab === CAT_TRACKER_SUBTABS[2] ? <OverviewGraphView /> : null}
    </section>
  )
}
