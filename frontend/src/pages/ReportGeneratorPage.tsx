import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart2, Download, FileSpreadsheet, FileText, Settings } from 'lucide-react'
import { formatAppDate } from '../lib/dateFormat'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import { fetchCompiledRecords, fetchRegionalResponses } from '../api/lists'
import { fetchReportConventions, fetchReportIssueCategories } from '../api/reports'
import { fetchHrRequests } from '../api/hrRequests'
import { fetchRegions } from '../api/regions'
import { useAuth } from '../auth/AuthContext'
import {
  CONCLUDING_OBSERVATIONS_LABEL,
  LOI_LABEL,
  issueEntryTitleColumnLabel,
} from '../lib/issueEntryKind'
import {
  buildReportData,
  type ReportBuildResult,
  type ReportFilters,
  type ReportInsightChart,
} from '../lib/reportGeneratorData'
import {
  REPORT_CHART_PRIMARY,
  REPORT_CHART_PRIMARY_FILL,
  reportColorForLabel,
} from '../lib/reportChartTheme'
import { DATE_RANGE_PRESET_LABELS, type DateRangePreset } from '../lib/reportDateRange'
import { downloadReportExcel } from '../lib/reportExcelExport'
import { downloadElementAsPdf } from '../lib/downloadElementAsPdf'
import { isFederalAdmin, isSuperAdmin } from '../lib/roles'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { PageSection } from '../components/ui/PageSection'
import { StatsCards } from '../components/ui/StatsCards'
import { TableCard } from '../components/ui/TableCard'

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

function ReportInsightChartPanel({ chart }: { chart: ReportInsightChart }) {
  if (chart.timeline?.length) {
    const data = chart.timeline.map((p) => ({ name: p.name, count: p.count }))
    if (chart.type === 'area') {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} width={32} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="count"
              stroke={REPORT_CHART_PRIMARY}
              fill={REPORT_CHART_PRIMARY_FILL}
              name="Count"
            />
          </AreaChart>
        </ResponsiveContainer>
      )
    }
    return (
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} width={32} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            stroke={REPORT_CHART_PRIMARY}
            strokeWidth={2}
            name="Count"
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (!chart.points.length) {
    return <p className="muted report-generator__chart-empty">No data for this chart with the current filters.</p>
  }

  if (chart.type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chart.points}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={4}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${String(name)} ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {chart.points.map((point, index) => (
              <Cell key={`cell-${index}`} fill={reportColorForLabel(point.name, index)} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chart.points} margin={{ left: 4, right: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={56} />
        <YAxis allowDecimals={false} width={32} />
        <Tooltip />
        <Bar dataKey="value" fill={REPORT_CHART_PRIMARY} radius={[4, 4, 0, 0]} name="Count" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ReportGeneratorPage() {
  const { user } = useAuth()
  const showRegionFilter = isSuperAdmin(user) || isFederalAdmin(user)
  const exportRef = useRef<HTMLDivElement>(null)

  const [regions, setRegions] = useState<Awaited<ReturnType<typeof fetchRegions>>>([])
  const [conventions, setConventions] = useState<Awaited<ReturnType<typeof fetchReportConventions>>>([])
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof fetchReportIssueCategories>>>([])
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof fetchHrRequests>>>([])
  const [responses, setResponses] = useState<Awaited<ReturnType<typeof fetchRegionalResponses>>>([])
  const [compiled, setCompiled] = useState<Awaited<ReturnType<typeof fetchCompiledRecords>>>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const now = new Date()
  const [filters, setFilters] = useState<ReportFilters>({
    dataSource: 'requests',
    regionId: '',
    convention: '',
    entryKind: '',
    categoryId: '',
    datePreset: 'this_year',
    dateFrom: '',
    dateTo: '',
    monthYearMonth: String(now.getMonth() + 1),
    monthYearYear: String(now.getFullYear()),
  })

  const [reportLoading, setReportLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [reportResult, setReportResult] = useState<ReportBuildResult | null>(null)

  useEffect(() => {
    void Promise.all([
      fetchRegions(),
      fetchReportConventions(),
      fetchReportIssueCategories(),
      fetchHrRequests(),
      fetchRegionalResponses(),
      fetchCompiledRecords(),
    ])
      .then(([reg, conv, cats, req, resp, comp]) => {
        setRegions(reg)
        setConventions(conv)
        setCategories(cats)
        setRequests(req)
        setResponses(resp)
        setCompiled(comp)
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'Failed to load data')
      })
  }, [])

  const yearOptions = useMemo(() => {
    const current = now.getFullYear()
    return Array.from({ length: 12 }, (_, i) => String(current - i))
  }, [])

  function handleGenerateReport() {
    setReportLoading(true)
    window.requestAnimationFrame(() => {
      try {
        const result = buildReportData(requests, responses, compiled, filters, {
          conventions,
          categories,
          regions,
        })
        setReportResult(result)
      } finally {
        setReportLoading(false)
      }
    })
  }

  function handleExportExcel() {
    if (!reportResult) return
    const base =
      filters.dataSource === 'requests'
        ? 'request-data-report'
        : filters.dataSource === 'responses'
          ? 'response-data-report'
          : 'compiled-data-report'
    downloadReportExcel(reportResult, base)
  }

  async function handleExportPdf() {
    if (!reportResult || !exportRef.current) return
    setPdfLoading(true)
    try {
      const base =
        filters.dataSource === 'requests'
          ? 'request-data-report'
          : filters.dataSource === 'responses'
            ? 'response-data-report'
            : 'compiled-data-report'
      await downloadElementAsPdf(exportRef.current, base, {
        captureClass: 'report-generator-pdf-capture',
        marginMm: 10,
      })
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'PDF export failed')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <PageSection
      titleIcon={<BarChart2 size={26} color="var(--solid-blue)" aria-hidden />}
      title="Report generator"
    >
      <div className="report-generator-page">
        {loadError && <p className="login-error">{loadError}</p>}

        <div className="report-generator">
          <div className="report-generator__card report-generator__card--config">
            <h3 className="report-generator__card-title">
              <Settings size={20} aria-hidden /> Report filters
            </h3>
            <div className="report-generator__grid-filters">
              <div className="report-generator__field">
                <label htmlFor="rg-data-source">Data source</label>
                <select
                  id="rg-data-source"
                  value={filters.dataSource}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      dataSource: e.target.value as ReportFilters['dataSource'],
                    })
                  }
                >
                  <option value="requests">Request data</option>
                  <option value="responses">Response data</option>
                  <option value="consolidated">Compiled data</option>
                </select>
              </div>

              {showRegionFilter ? (
                <div className="report-generator__field">
                  <label htmlFor="rg-region">Region</label>
                  <select
                    id="rg-region"
                    value={filters.regionId}
                    onChange={(e) => setFilters({ ...filters, regionId: e.target.value })}
                  >
                    <option value="">All regions</option>
                    {regions.map((r) => (
                      <option key={r.id} value={String(r.id)}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="report-generator__field">
                <label htmlFor="rg-convention">Convention</label>
                <select
                  id="rg-convention"
                  value={filters.convention}
                  onChange={(e) => setFilters({ ...filters, convention: e.target.value })}
                >
                  <option value="">All conventions</option>
                  {conventions.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.code ? `${c.code} — ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="report-generator__field">
                <label htmlFor="rg-entry-kind">{issueEntryTitleColumnLabel()}</label>
                <select
                  id="rg-entry-kind"
                  value={filters.entryKind}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      entryKind: e.target.value as ReportFilters['entryKind'],
                    })
                  }
                >
                  <option value="">All</option>
                  <option value="issue">{LOI_LABEL}</option>
                  <option value="recommendation">{CONCLUDING_OBSERVATIONS_LABEL}</option>
                </select>
              </div>

              <div className="report-generator__field">
                <label htmlFor="rg-category">Categories</label>
                <select
                  id="rg-category"
                  value={filters.categoryId}
                  onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="report-generator__field report-generator__field--span2">
                <label htmlFor="rg-date-preset">Date range</label>
                <select
                  id="rg-date-preset"
                  value={filters.datePreset}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      datePreset: e.target.value as DateRangePreset,
                    })
                  }
                >
                  {(Object.keys(DATE_RANGE_PRESET_LABELS) as DateRangePreset[]).map((key) => (
                    <option key={key} value={key}>
                      {DATE_RANGE_PRESET_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>

              {filters.datePreset === 'month_year' ? (
                <div className="report-generator__field report-generator__field--span2">
                  <div className="report-generator__field-row">
                    <div>
                      <label htmlFor="rg-month">Month</label>
                      <select
                        id="rg-month"
                        value={filters.monthYearMonth}
                        onChange={(e) => setFilters({ ...filters, monthYearMonth: e.target.value })}
                      >
                        {MONTH_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="rg-year">Year</label>
                      <select
                        id="rg-year"
                        value={filters.monthYearYear}
                        onChange={(e) => setFilters({ ...filters, monthYearYear: e.target.value })}
                      >
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}

              {filters.datePreset === 'custom' ? (
                <div className="report-generator__field report-generator__field--span2">
                  <div className="report-generator__field-row">
                    <div>
                      <label htmlFor="rg-from">From</label>
                      <input
                        id="rg-from"
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="rg-to">To</label>
                      <input
                        id="rg-to"
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="report-generator__actions">
              <Button variant="primary" compact onClick={handleGenerateReport} disabled={reportLoading}>
                <BarChart2 size={16} aria-hidden />
                {reportLoading ? 'Generating…' : 'Generate report'}
              </Button>
            </div>
          </div>

          {reportResult ? (
            <div ref={exportRef} className="report-generator__results report-generator__results--full">
              <div className="report-generator__results-head">
                <div>
                  <h3>{reportResult.title}</h3>
                  <p className="muted report-generator__filter-summary">{reportResult.filterSummary}</p>
                </div>
                <div className="report-generator__export-actions">
                  <Button variant="secondary" compact onClick={handleExportPdf} disabled={pdfLoading}>
                    <FileText size={16} aria-hidden />
                    {pdfLoading ? 'Preparing PDF…' : 'Download PDF'}
                  </Button>
                  <Button variant="primary" compact onClick={handleExportExcel}>
                    <span className="report-exports-download-btn__inner">
                      <FileSpreadsheet size={16} aria-hidden />
                      Download Excel
                    </span>
                  </Button>
                </div>
              </div>

              <StatsCards items={reportResult.metrics.map((m) => ({ label: m.label, value: m.value }))} />

              <div className="report-generator__charts-grid">
                {reportResult.charts.map((chart) => (
                  <div key={chart.id} className="report-generator__chart-panel report-generator__chart-panel--grid">
                    <h4 className="chart-caption">{chart.title}</h4>
                    <ReportInsightChartPanel chart={chart} />
                  </div>
                ))}
              </div>

              <TableCard padded className="report-generator__table-card">
                <div className="report-generator__table-head">
                  <h4>Report data ({reportResult.tableRows.length} rows)</h4>
                  <Button variant="secondary" compact onClick={handleExportExcel}>
                    <Download size={16} aria-hidden /> Export table
                  </Button>
                </div>
                <div className="table-card-scroll">
                  <table className="data-table report-generator__data-table">
                    <thead>
                      <tr>
                        {reportResult.tableHeaders.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportResult.tableRows.map((row, idx) => (
                        <tr key={idx}>
                          {reportResult.tableHeaders.map((h) => {
                            const raw = row[h]
                            const display =
                              h.toLowerCase().includes('date') && typeof raw === 'string' && raw
                                ? formatAppDate(raw)
                                : raw
                            return <td key={h}>{display ?? '—'}</td>
                          })}
                        </tr>
                      ))}
                      {reportResult.tableRows.length === 0 && (
                        <EmptyStateRow
                          colSpan={reportResult.tableHeaders.length}
                          message="No records match the selected filters."
                        />
                      )}
                    </tbody>
                  </table>
                </div>
              </TableCard>
            </div>
          ) : (
            <div className="report-generator__empty">
              {reportLoading ? (
                <div className="report-generator__loading-pulse">
                  <div className="report-generator__loading-dot" />
                  <div className="report-generator__loading-bar" style={{ width: 256 }} />
                  <p className="report-generator__loading-msg">Building report from live data…</p>
                </div>
              ) : (
                <div className="report-generator__empty-inner">
                  <BarChart2 size={56} style={{ opacity: 0.35 }} aria-hidden />
                  <h4>Configure filters and generate a report</h4>
                  <p>
                    Select data source, convention, {issueEntryTitleColumnLabel().toLowerCase()}, category, and date
                    range. Regional and department portals see only data in their scope. Federal users can filter by
                    region.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageSection>
  )
}
