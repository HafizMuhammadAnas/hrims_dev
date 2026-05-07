import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BarChart2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Globe,
  Grid,
  Layers,
  Lightbulb,
  PenLine,
  Search,
  Settings,
  Sparkles,
  Target,
  RefreshCcw,
} from 'lucide-react'
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
import { fetchCompiledRecords, fetchRegionalResponses, fetchViolationEntries } from '../api/lists'
import { fetchHrRequests } from '../api/hrRequests'
import {
  fetchKnowledgeConventions,
  fetchKnowledgeIndicators,
  fetchKnowledgeSdgGoals,
} from '../api/knowledgeHub'
import { fetchRegions } from '../api/regions'
import {
  buildReportPreview,
  type ChartKind,
  type ReportPreviewResult,
  type ReportPreviewFilters,
} from '../lib/reportPreviewData'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { PageSection } from '../components/ui/PageSection'
import { StatsCards } from '../components/ui/StatsCards'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'

const PREBUILT_PROMPTS = [
  {
    category: 'Compliance & Trends',
    questions: [
      'Analyze the compliance trend over the last 5 years.',
      'Compare implementation rates against national averages.',
      'Identify the top 3 overdue items and reasons for delay.',
    ],
  },
  {
    category: 'Demographics & Impact',
    questions: [
      'What is the impact of recent policies on target demographics?',
      'Show distribution in leadership roles.',
      'Analyze regional disparities in access.',
    ],
  },
  {
    category: 'Patterns & Efficiency',
    questions: [
      'Evaluate the correlation between funding and successful completion.',
      'Which department has the highest response efficiency?',
    ],
  },
  {
    category: 'Gaps & National Alignment',
    questions: [
      'Correlate local progress with SDG targets.',
      'Map current status against UPR recommendations.',
    ],
  },
] as const

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

type ReportType = 'summary' | 'regional-responses' | 'compiled-records' | 'violations'

function ReportPreviewChart({ result }: { result: ReportPreviewResult }) {
  const axis = (
    <>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="name" />
      <YAxis allowDecimals={false} />
      <Tooltip />
      <Legend />
    </>
  )

  const showSecondary = result.timelineData.some((d) => d.secondary > 0)

  switch (result.chartType) {
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={result.timelineData}>
            {axis}
            <Line type="monotone" dataKey="primary" stroke="#8884d8" strokeWidth={2} name="Primary" />
            {showSecondary ? (
              <Line type="monotone" dataKey="secondary" stroke="#82ca9d" strokeWidth={2} name="Secondary" />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      )
    case 'bar':
      if (!result.barData.length) {
        return <div className="report-generator__chart-caption">No rows to chart for this filter set.</div>
      }
      return (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={result.barData} margin={{ left: 8, right: 12 }}>
            {axis}
            <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} name="Count" />
          </BarChart>
        </ResponsiveContainer>
      )
    case 'area':
      return (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={result.timelineData}>
            {axis}
            <Area type="monotone" dataKey="primary" stroke="#8884d8" fill="#8884d8" name="Primary" />
            {showSecondary ? (
              <Area type="monotone" dataKey="secondary" stroke="#82ca9d" fill="#82ca9d" name="Secondary" />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      )
    case 'pie':
    default:
      if (!result.pieData.length) {
        return <div className="report-generator__chart-caption">No categories to chart for this filter set.</div>
      }
      return (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={result.pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${String(name)} ${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {result.pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )
  }
}

function OperationalExportsPanel({ embedded = false }: { embedded?: boolean }) {
  const [reportType, setReportType] = useState<ReportType>('summary')
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof fetchHrRequests>>>([])
  const [responses, setResponses] = useState<Awaited<ReturnType<typeof fetchRegionalResponses>>>([])
  const [compiled, setCompiled] = useState<Awaited<ReturnType<typeof fetchCompiledRecords>>>([])
  const [violations, setViolations] = useState<Awaited<ReturnType<typeof fetchViolationEntries>>>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([
      fetchHrRequests(),
      fetchRegionalResponses(),
      fetchCompiledRecords(),
      fetchViolationEntries(),
    ])
      .then(([req, resp, comp, vio]) => {
        setRequests(req)
        setResponses(resp)
        setCompiled(comp)
        setViolations(vio)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load report data'))
  }, [])

  const summary = useMemo(() => {
    const byStatus = requests.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1
      return acc
    }, {})
    return {
      totalRequests: requests.length,
      totalResponses: responses.length,
      totalCompiled: compiled.length,
      totalViolations: violations.length,
      byStatus,
    }
  }, [requests, responses, compiled, violations])

  const summaryTiles = useMemo(
    () => [
      { label: 'HR requests', value: summary.totalRequests },
      { label: 'Regional responses', value: summary.totalResponses },
      { label: 'Compiled records', value: summary.totalCompiled },
      { label: 'Violation entries', value: summary.totalViolations },
    ],
    [summary],
  )

  function downloadCsv(name: string, headers: string[], rows: (string | number)[][]) {
    const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`
    const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportCurrent() {
    if (reportType === 'summary') {
      downloadCsv(
        'summary-report',
        ['Metric', 'Value'],
        [
          ['Total HR Requests', summary.totalRequests],
          ['Total Regional Responses', summary.totalResponses],
          ['Total Compiled Records', summary.totalCompiled],
          ['Total Violation Entries', summary.totalViolations],
          ...Object.entries(summary.byStatus).map(([k, v]) => [`Requests (${k})`, v]),
        ],
      )
      return
    }
    if (reportType === 'regional-responses') {
      downloadCsv(
        'regional-responses-report',
        ['Response ID', 'Request ID', 'Region', 'Title', 'Submission Date', 'Review Status'],
        responses.map((r) => [
          r.id,
          r.req_id,
          r.region_name ?? '',
          r.title,
          r.submission_date,
          r.review_status,
        ]),
      )
      return
    }
    if (reportType === 'compiled-records') {
      downloadCsv(
        'compiled-records-report',
        ['Compiled ID', 'HR request', 'Title', 'Regions', 'Status', 'Compilation Date'],
        compiled.map((c) => [
          c.id,
          c.req_id ?? '',
          c.title,
          (c.region_names ?? []).join('; '),
          c.status,
          c.compilation_date ?? '',
        ]),
      )
      return
    }
    downloadCsv(
      'violation-entries-report',
      ['Entry Number', 'Title', 'Region', 'Event Date', 'Monitoring Status'],
      violations.map((v) => [v.entry_number, v.title, v.region_name ?? '', v.event_date, v.monitoring_status]),
    )
  }

  const body = (
    <>
      {error && <p className="login-error">{error}</p>}
      <StatsCards items={summaryTiles.map((tile) => ({ label: tile.label, value: tile.value }))} />
      <TableToolbar className="report-exports-toolbar">
        <select
          className="report-exports-toolbar__select"
          value={reportType}
          onChange={(e) => setReportType(e.target.value as ReportType)}
          aria-label="Report type"
        >
          <option value="summary">Executive summary</option>
          <option value="regional-responses">Regional responses report</option>
          <option value="compiled-records">Compiled records report</option>
          <option value="violations">Violation entries report</option>
        </select>
        <Button variant="primary" compact onClick={exportCurrent} className="report-exports-download-btn">
          <span className="report-exports-download-btn__inner">
            <Download size={16} aria-hidden />
            Download CSV
          </span>
        </Button>
      </TableToolbar>

      <TableCard padded className="report-exports-table-card">
        {reportType === 'summary' && (
          <div className="report-exports-summary-inner">
            <h3 className="report-exports__snapshot-title">Executive summary snapshot</h3>
            {Object.keys(summary.byStatus).length === 0 ? (
              <p className="muted report-exports-empty-hint">No request status breakdown in your current scope.</p>
            ) : (
              <div className="summary-metric-grid">
                {Object.entries(summary.byStatus).map(([k, v]) => (
                  <div className="summary-metric-card" key={k}>
                    <div className="summary-metric-title">Requests ({k})</div>
                    <div className="summary-metric-value">{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {reportType === 'regional-responses' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Request</th>
                <th>Region</th>
                <th>Title</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.req_id}</td>
                  <td>{r.region_name}</td>
                  <td>{r.title}</td>
                  <td>{r.submission_date}</td>
                  <td>{r.review_status}</td>
                </tr>
              ))}
              {responses.length === 0 && (
                <EmptyStateRow colSpan={6} message="No regional responses in your scope for this export." />
              )}
            </tbody>
          </table>
        )}
        {reportType === 'compiled-records' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>HR request</th>
                <th>Title</th>
                <th>Regions</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {compiled.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.req_id ?? '—'}</td>
                  <td>{c.title}</td>
                  <td>{c.region_names?.join(', ')}</td>
                  <td>{c.status}</td>
                </tr>
              ))}
              {compiled.length === 0 && (
                <EmptyStateRow colSpan={5} message="No compiled records in your scope for this export." />
              )}
            </tbody>
          </table>
        )}
        {reportType === 'violations' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Entry #</th>
                <th>Title</th>
                <th>Region</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v) => (
                <tr key={v.id}>
                  <td>{v.entry_number}</td>
                  <td>{v.title}</td>
                  <td>{v.region_name}</td>
                  <td>{v.event_date}</td>
                  <td>{v.monitoring_status}</td>
                </tr>
              ))}
              {violations.length === 0 && (
                <EmptyStateRow colSpan={5} message="No violation entries in your scope for this export." />
              )}
            </tbody>
          </table>
        )}
      </TableCard>
    </>
  )

  if (embedded) {
    return (
      <div className="report-exports">
        <div className="report-exports__head">
          <h3>Operational dataset export</h3>
        </div>
        {body}
      </div>
    )
  }

  return (
    <PageSection title="Operational dataset export">
      {body}
    </PageSection>
  )
}

type ReportMainTab = 'analysis' | 'exports'

export function ReportGeneratorPage() {
  const [mainTab, setMainTab] = useState<ReportMainTab>('analysis')
  const [regions, setRegions] = useState<Awaited<ReturnType<typeof fetchRegions>>>([])
  const [conventions, setConventions] = useState<Awaited<ReturnType<typeof fetchKnowledgeConventions>>>([])
  const [sdgs, setSdgs] = useState<Awaited<ReturnType<typeof fetchKnowledgeSdgGoals>>>([])
  const [indicators, setIndicators] = useState<Awaited<ReturnType<typeof fetchKnowledgeIndicators>>>([])
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof fetchHrRequests>>>([])
  const [responses, setResponses] = useState<Awaited<ReturnType<typeof fetchRegionalResponses>>>([])
  const [compiled, setCompiled] = useState<Awaited<ReturnType<typeof fetchCompiledRecords>>>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    dataSource: 'requests' as ReportPreviewFilters['dataSource'],
    province: '',
    convention: '',
    issueCategory: '',
    sdg: '',
    indicator: '',
    uprCycle: '',
    dateFrom: '',
    dateTo: '',
  })

  const [expandedSection, setExpandedSection] = useState<string | null>(PREBUILT_PROMPTS[0].category)
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([])
  const [customPrompt, setCustomPrompt] = useState('')
  const [chartType, setChartType] = useState<ChartKind>('pie')

  const [reportLoading, setReportLoading] = useState(false)
  const [reportResult, setReportResult] = useState<ReportPreviewResult | null>(null)

  useEffect(() => {
    void Promise.all([
      fetchRegions(),
      fetchKnowledgeConventions(),
      fetchKnowledgeSdgGoals(),
      fetchKnowledgeIndicators(),
      fetchHrRequests(),
      fetchRegionalResponses(),
      fetchCompiledRecords(),
    ])
      .then(([reg, conv, sdgList, indList, req, resp, comp]) => {
        setRegions(reg)
        setConventions(conv)
        setSdgs(sdgList)
        setIndicators(indList)
        setRequests(req)
        setResponses(resp)
        setCompiled(comp)
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'Failed to load data')
      })
  }, [])

  const issueCategoryOptions = useMemo(() => {
    const u = [
      ...new Set(
        requests.map((r) => r.issue?.category?.name).filter(Boolean) as string[],
      ),
    ].sort()
    return u
  }, [requests])

  function togglePrompt(prompt: string) {
    setSelectedPrompts((prev) =>
      prev.includes(prompt) ? prev.filter((p) => p !== prompt) : [...prev, prompt],
    )
  }

  function toggleSection(category: string) {
    setExpandedSection((prev) => (prev === category ? null : category))
  }

  function handleGenerateReport() {
    setReportLoading(true)
    setReportResult(null)
    const previewFilters: ReportPreviewFilters = {
      dataSource: filters.dataSource,
      province: filters.province,
      convention: filters.convention,
      issueCategory: filters.issueCategory,
      sdg: filters.sdg,
      indicator: filters.indicator,
      uprCycle: filters.uprCycle,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }
    window.requestAnimationFrame(() => {
      try {
        const result = buildReportPreview(
          requests,
          responses,
          compiled,
          previewFilters,
          chartType,
          selectedPrompts,
          customPrompt,
        )
        setReportResult(result)
      } finally {
        setReportLoading(false)
      }
    })
  }

  return (
    <PageSection
      titleIcon={<BarChart2 size={26} color="var(--solid-blue)" aria-hidden />}
      title="Report generator"
    >
      <div className="report-generator-page">
        {loadError && <p className="login-error">{loadError}</p>}

        <div className="report-generator__tabs" role="tablist" aria-label="Report generator mode">
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === 'analysis'}
            className={
              'report-generator__tab' + (mainTab === 'analysis' ? ' report-generator__tab--active' : '')
            }
            onClick={() => setMainTab('analysis')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={16} aria-hidden /> Report preview
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === 'exports'}
            className={
              'report-generator__tab' + (mainTab === 'exports' ? ' report-generator__tab--active' : '')
            }
            onClick={() => setMainTab('exports')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <FileSpreadsheet size={16} aria-hidden /> Data export
            </span>
          </button>
        </div>

        {mainTab === 'exports' ? (
          <div className="report-generator-exports-shell">
            <OperationalExportsPanel embedded />
          </div>
        ) : (
          <>
            <div className="report-generator__callout">
              <Sparkles size={18} color="var(--solid-blue)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
              <span>
                <strong>Tip:</strong> choose filters, then <strong>Generate report</strong> to refresh the summary and
                chart from the database. Optional checklists and notes are included verbatim in the executive summary.
              </span>
            </div>

            <div className="report-generator__workspace">
              <div className="report-generator">
                <div className="report-generator__card report-generator__card--config">
                  <h3 className="report-generator__card-title">
                    <Settings size={20} aria-hidden /> Report configuration parameters
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
                            dataSource: e.target.value as ReportPreviewFilters['dataSource'],
                          })
                        }
                      >
                        <option value="requests">Request data</option>
                        <option value="responses">Response data</option>
                        <option value="consolidated">Consolidated records</option>
                      </select>
                    </div>

                    <div className="report-generator__field">
                      <label htmlFor="rg-region">Province / region</label>
                      <select
                        id="rg-region"
                        value={filters.province}
                        onChange={(e) => setFilters({ ...filters, province: e.target.value })}
                      >
                        <option value="">National (All)</option>
                        {regions.map((r) => (
                          <option key={r.id} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="report-generator__field">
                      <label htmlFor="rg-convention">Convention</label>
                      <select
                        id="rg-convention"
                        value={filters.convention}
                        onChange={(e) => setFilters({ ...filters, convention: e.target.value })}
                      >
                        <option value="">All conventions</option>
                        {conventions.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.code ? `${c.code} — ${c.name}` : c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="report-generator__field">
                      <label htmlFor="rg-issue-cat">Issue category (from records)</label>
                      <select
                        id="rg-issue-cat"
                        value={filters.issueCategory}
                        onChange={(e) => setFilters({ ...filters, issueCategory: e.target.value })}
                      >
                        <option value="">All categories</option>
                        {issueCategoryOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="report-generator__field">
                      <label htmlFor="rg-sdg">
                        <Globe size={12} aria-hidden /> SDG goal
                      </label>
                      <select
                        id="rg-sdg"
                        value={filters.sdg}
                        onChange={(e) => setFilters({ ...filters, sdg: e.target.value })}
                      >
                        <option value="">All SDGs</option>
                        {sdgs.map((s) => (
                          <option key={s.id} value={s.title}>
                            {s.goal_number != null ? `Goal ${s.goal_number}: ${s.title}` : s.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="report-generator__field">
                      <label htmlFor="rg-indicator">
                        <Target size={12} aria-hidden /> HR indicator
                      </label>
                      <select
                        id="rg-indicator"
                        value={filters.indicator}
                        onChange={(e) => setFilters({ ...filters, indicator: e.target.value })}
                      >
                        <option value="">All indicators</option>
                        {indicators.map((i) => (
                          <option key={i.id} value={i.title}>
                            {i.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="report-generator__field">
                      <label htmlFor="rg-upr">
                        <RefreshCcw size={12} aria-hidden /> UPR cycle
                      </label>
                      <select
                        id="rg-upr"
                        value={filters.uprCycle}
                        onChange={(e) => setFilters({ ...filters, uprCycle: e.target.value })}
                      >
                        <option value="">Any cycle</option>
                        <option value="4th">4th cycle (current)</option>
                        <option value="3rd">3rd cycle</option>
                        <option value="2nd">2nd cycle</option>
                        <option value="1st">1st cycle</option>
                      </select>
                    </div>

                    <div className="report-generator__field">
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
                  </div>
                </div>

                <div className="report-generator__layout">
                  <div className="report-generator__col-query">
                    <div className="report-generator__card report-generator__card--query">
                      <h3 className="report-generator__card-title">
                        <Search size={20} aria-hidden /> Query builder
                      </h3>

                      <div style={{ marginBottom: '1.25rem' }}>
                        <span className="report-generator__section-label">Suggested review topics (notes only)</span>
                        {PREBUILT_PROMPTS.map((section) => {
                          const isExpanded = expandedSection === section.category
                          return (
                            <div key={section.category} className="report-generator__prompt-section">
                              <button
                                type="button"
                                className={
                                  'report-generator__prompt-head ' +
                                  (isExpanded
                                    ? 'report-generator__prompt-head--open'
                                    : 'report-generator__prompt-head--closed')
                                }
                                onClick={() => toggleSection(section.category)}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Layers size={14} aria-hidden /> {section.category}
                                </span>
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                              {isExpanded && (
                                <div className="report-generator__prompt-body">
                                  {section.questions.map((q) => (
                                    <label
                                      key={q}
                                      className={
                                        'report-generator__prompt-item ' +
                                        (selectedPrompts.includes(q)
                                          ? 'report-generator__prompt-item--selected'
                                          : '')
                                      }
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedPrompts.includes(q)}
                                        onChange={() => togglePrompt(q)}
                                      />
                                      <span>{q}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      <div className="report-generator__field" style={{ marginBottom: '1.25rem' }}>
                        <label htmlFor="rg-custom" style={{ marginBottom: 8 }}>
                          Custom notes
                        </label>
                        <div className="report-generator__textarea-wrap">
                          <textarea
                            id="rg-custom"
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder="Optional — appended to the executive summary as your own notes."
                          />
                          <PenLine className="report-generator__textarea-icon" size={16} aria-hidden />
                        </div>
                      </div>

                      <div className="report-generator__field" style={{ marginBottom: '1.25rem' }}>
                        <label htmlFor="rg-viz" style={{ marginBottom: 8 }}>
                          Visualization type
                        </label>
                        <div className="report-generator__viz-wrap">
                          <select
                            id="rg-viz"
                            value={chartType}
                            onChange={(e) => setChartType(e.target.value as ChartKind)}
                          >
                            <option value="pie">Pie chart (distribution)</option>
                            <option value="line">Line chart (trend — last 6 months)</option>
                            <option value="bar">Bar chart (top categories)</option>
                            <option value="area">Area chart (trend — last 6 months)</option>
                          </select>
                          <Activity className="activity-icon" size={16} aria-hidden />
                        </div>
                      </div>

                      <button
                        type="button"
                        className="report-generator__btn-generate"
                        onClick={handleGenerateReport}
                        disabled={reportLoading}
                      >
                        {reportLoading ? (
                          'Working…'
                        ) : (
                          <>
                            <BarChart2 size={18} aria-hidden /> Generate report
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="report-generator__col-preview">
                    {reportResult ? (
                      <div className="report-generator__results">
                        <div className="report-generator__results-head">
                          <h3>{reportResult.title}</h3>
                          <button type="button" className="report-generator__icon-btn" title="Download PDF (coming soon)">
                            <Download size={20} aria-hidden />
                          </button>
                        </div>

                        <div className="report-generator__result-grid">
                          <div>
                            <div className="report-generator__exec">
                              <h4>Executive summary</h4>
                              <p>{reportResult.intro}</p>
                            </div>

                            <div className="report-generator__insights">
                              <h4>
                                <CheckSquare size={18} color="#6366f1" aria-hidden /> Key metrics
                              </h4>
                              {reportResult.insights.map((insight, idx) => (
                                <div key={`${insight.label}-${idx}`} className="report-generator__insight-card">
                                  <h5>
                                    {idx + 1}. {insight.label}
                                  </h5>
                                  <p>{insight.text}</p>
                                </div>
                              ))}
                            </div>

                            <div className="report-generator__recommend">
                              <div className="report-generator__recommend-bulb">
                                <Lightbulb color="#ca8a04" size={20} aria-hidden />
                              </div>
                              <div>
                                <h4>Operational note</h4>
                                <p>{reportResult.recommendation}</p>
                              </div>
                            </div>
                          </div>

                          <div className="report-generator__chart-panel">
                            <h4>
                              <BarChart2 size={16} aria-hidden /> Visualization (live data)
                            </h4>
                            <ReportPreviewChart result={reportResult} />
                            <p className="report-generator__chart-caption">
                              Based on filtered {filters.dataSource} in your HRIMS scope.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="report-generator__empty">
                        {reportLoading ? (
                          <div className="report-generator__loading-pulse">
                            <div className="report-generator__loading-dot" />
                            <div className="report-generator__loading-bar" style={{ width: 256 }} />
                            <div className="report-generator__loading-bar" style={{ width: 160 }} />
                            <p className="report-generator__loading-msg">Building report from live data…</p>
                          </div>
                        ) : (
                          <div className="report-generator__empty-inner">
                            <div className="report-generator__steps" aria-hidden>
                              <span className="report-generator__step">
                                <span className="report-generator__step-num">1</span> Configure
                              </span>
                              <span className="report-generator__step-sep">→</span>
                              <span className="report-generator__step">
                                <span className="report-generator__step-num">2</span> Notes
                              </span>
                              <span className="report-generator__step-sep">→</span>
                              <span className="report-generator__step">
                                <span className="report-generator__step-num">3</span> Preview
                              </span>
                            </div>
                            <Grid size={56} style={{ opacity: 0.35 }} aria-hidden />
                            <h4>Ready to generate report</h4>
                            <p>
                              Set filters and click <strong>Generate report</strong> to see database-driven metrics and
                              charts for your account.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageSection>
  )
}
