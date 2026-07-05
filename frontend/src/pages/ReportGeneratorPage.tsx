import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BarChart2, FileText, LayoutDashboard, RotateCcw, Settings } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { fetchCompiledRecords, fetchRegionalResponses } from '../api/lists'
import {
  fetchReportArticles,
  fetchReportConventions,
  fetchReportIndicators,
  fetchReportIssueArticleLinks,
  fetchReportIssueCategories,
  type ReportLookupArticle,
  type ReportLookupIndicator,
} from '../api/reports'
import { fetchHrRequests } from '../api/hrRequests'
import { fetchRegions } from '../api/regions'
import { useAuth } from '../auth/AuthContext'
import {
  CONCLUDING_OBSERVATIONS_LABEL,
  LOI_LABEL,
  issueEntryTitleColumnLabel,
} from '../lib/issueEntryKind'
import {
  buildReportingDashboard,
  type ReportChartPoint,
  type ReportFilterSummaryPart,
  type ReportFilters,
  type ReportRankRow,
  type ReportingDashboardResult,
  type ReportingDashboardSummaryCards,
} from '../lib/reportGeneratorData'
import { reportColorForLabel, reportDashboardChartColor } from '../lib/reportChartTheme'
import { DATE_RANGE_PRESET_LABELS, type DateRangePreset } from '../lib/reportDateRange'
import { downloadElementAsPdf } from '../lib/downloadElementAsPdf'
import { isFederalAdmin, isRegionalAdmin, isSuperAdmin } from '../lib/roles'
import { ReportingIndicatorCompiledFocus } from '../components/ReportingIndicatorCompiledFocus'
import { Button } from '../components/ui/Button'
import { PageSection } from '../components/ui/PageSection'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { StatsCards } from '../components/ui/StatsCards'

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

const COMPILED_DATA_SOURCE: ReportFilters['dataSource'] = 'consolidated'

function createDefaultReportFilters(lockedRegionalId: string): ReportFilters {
  const now = new Date()
  return {
    dataSource: COMPILED_DATA_SOURCE,
    regionId: lockedRegionalId,
    convention: '',
    articleId: '',
    entryKind: '',
    categoryId: '',
    indicatorId: '',
    datePreset: 'this_year',
    dateFrom: '',
    dateTo: '',
    monthYearMonth: String(now.getMonth() + 1),
    monthYearYear: String(now.getFullYear()),
  }
}

function reportFiltersAreApplied(current: ReportFilters, defaults: ReportFilters): boolean {
  return (
    current.convention !== defaults.convention ||
    current.articleId !== defaults.articleId ||
    current.entryKind !== defaults.entryKind ||
    current.categoryId !== defaults.categoryId ||
    current.indicatorId !== defaults.indicatorId ||
    current.datePreset !== defaults.datePreset ||
    current.dateFrom !== defaults.dateFrom ||
    current.dateTo !== defaults.dateTo ||
    current.monthYearMonth !== defaults.monthYearMonth ||
    current.monthYearYear !== defaults.monthYearYear ||
    current.regionId !== defaults.regionId
  )
}

function rankStatusColor(percent: number): string {
  if (percent >= 70) return '#22c55e'
  if (percent >= 40) return '#eab308'
  return '#f97316'
}

function MultiColorBarChart({
  data,
  emptyMessage,
}: {
  data: ReportChartPoint[]
  emptyMessage: string
}) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return <p className="muted reporting-dashboard__chart-empty">{emptyMessage}</p>
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 4, right: 8, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={56} />
        <YAxis allowDecimals={false} width={36} />
        <Tooltip />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Records">
          {data.map((point, index) => (
            <Cell key={point.name} fill={reportDashboardChartColor(index)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function DonutChartPanel({
  data,
  title,
}: {
  data: ReportChartPoint[]
  title: string
}) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return <p className="muted reporting-dashboard__chart-empty">No {title.toLowerCase()} for the current filters.</p>
  }
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={58}
          outerRadius={88}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
        >
          {data.map((point, index) => (
            <Cell key={point.name} fill={reportDashboardChartColor(index)} />
          ))}
        </Pie>
        <Tooltip />
        <Legend
          formatter={(value, entry) => {
            const v = (entry.payload as ReportChartPoint | undefined)?.value ?? 0
            const pct = total > 0 ? Math.round((v / total) * 100) : 0
            return `${String(value)} (${v}, ${pct}%)`
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

function ReportingRankPanel({
  title,
  rows,
  variant = 'indicators',
}: {
  title: string
  rows: ReportRankRow[]
  variant?: 'categories' | 'indicators'
}) {
  const showId = variant === 'indicators'
  return (
    <div className="reporting-rank-panel">
      <h4 className="reporting-rank-panel__title">{title}</h4>
      {rows.length === 0 ? (
        <p className="muted reporting-dashboard__chart-empty">No data for the current filters.</p>
      ) : (
        <div className="reporting-rank-panel__list">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className={`reporting-rank-row${showId ? '' : ' reporting-rank-row--label-only'}`}
            >
              {showId ? <span className="reporting-rank-row__id">{row.shortLabel}</span> : null}
              <span className="reporting-rank-row__label" title={row.label}>
                {row.label}
              </span>
              <div className="reporting-rank-row__bar-track">
                <div
                  className="reporting-rank-row__bar-fill"
                  style={{
                    width: `${row.barPercent}%`,
                    background: reportColorForLabel(row.label, index),
                  }}
                />
              </div>
              <span className="reporting-rank-row__pct">{row.percent}%</span>
              <span
                className="reporting-rank-row__dot"
                style={{ background: rankStatusColor(row.percent) }}
                aria-hidden
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportingFilterSummary({ parts }: { parts: ReportFilterSummaryPart[] }) {
  return (
    <p className="reporting-dashboard__filter-summary">
      {parts.map((part, index) => (
        <span key={`${part.label}-${index}`} className="reporting-dashboard__filter-part">
          {index > 0 ? <span className="reporting-dashboard__filter-sep" aria-hidden> · </span> : null}
          <strong className="reporting-dashboard__filter-label">{part.label}:</strong>{' '}
          <span className="reporting-dashboard__filter-value">{part.value}</span>
        </span>
      ))}
    </p>
  )
}

function ReportingSummaryCards({ cards }: { cards: ReportingDashboardSummaryCards }) {
  return (
    <StatsCards
      variant="titleTop"
      className="reporting-dashboard__summary-row"
      items={[
        { label: 'Articles', value: cards.articles },
        {
          label: LOI_LABEL,
          value: cards.loiCount,
          detail: `${cards.loiIndicatorCount} indicator${cards.loiIndicatorCount === 1 ? '' : 's'}`,
        },
        {
          label: CONCLUDING_OBSERVATIONS_LABEL,
          value: cards.concludingCount,
          detail: `${cards.concludingIndicatorCount} indicator${cards.concludingIndicatorCount === 1 ? '' : 's'}`,
        },
        { label: 'Categories used', value: cards.categoriesCount },
        {
          label: 'Response rate',
          value: `${cards.responsePercent}%`,
          detail: `${cards.requestsWithResponse} of ${cards.requestCount} request${cards.requestCount === 1 ? '' : 's'} · ${cards.responseCount} response${cards.responseCount === 1 ? '' : 's'}`,
        },
      ]}
    />
  )
}

export function ReportGeneratorPage() {
  const { user } = useAuth()
  const federalPortal = isFederalAdmin(user) || isSuperAdmin(user)
  const regionalPortal = isRegionalAdmin(user)
  const canAccessReportGenerator = federalPortal || regionalPortal

  if (!user || !canAccessReportGenerator) {
    return <Navigate to="/" replace />
  }

  const lockedRegionalId =
    regionalPortal && user.region?.id != null ? String(user.region.id) : ''

  const exportRef = useRef<HTMLDivElement>(null)

  const [regions, setRegions] = useState<Awaited<ReturnType<typeof fetchRegions>>>([])
  const [conventions, setConventions] = useState<Awaited<ReturnType<typeof fetchReportConventions>>>([])
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof fetchReportIssueCategories>>>([])
  const [articles, setArticles] = useState<ReportLookupArticle[]>([])
  const [indicators, setIndicators] = useState<ReportLookupIndicator[]>([])
  const [issueArticleLinks, setIssueArticleLinks] = useState<
    Array<{ issue_id: number; article_id: number }>
  >([])
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof fetchHrRequests>>>([])
  const [responses, setResponses] = useState<Awaited<ReturnType<typeof fetchRegionalResponses>>>([])
  const [compiled, setCompiled] = useState<Awaited<ReturnType<typeof fetchCompiledRecords>>>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const now = new Date()
  const defaultFilters = useMemo(
    () => createDefaultReportFilters(lockedRegionalId),
    [lockedRegionalId],
  )
  const [filters, setFilters] = useState<ReportFilters>(() => createDefaultReportFilters(lockedRegionalId))

  const [reportLoading, setReportLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [dashboardResult, setDashboardResult] = useState<ReportingDashboardResult | null>(null)

  useEffect(() => {
    void Promise.all([
      fetchRegions(),
      fetchReportConventions(),
      fetchReportIssueCategories(),
      fetchReportArticles(),
      fetchReportIssueArticleLinks(),
      fetchHrRequests(),
      fetchRegionalResponses(),
      fetchCompiledRecords(),
    ])
      .then(([reg, conv, cats, arts, links, req, resp, comp]) => {
        setRegions(reg)
        setConventions(conv)
        setCategories(cats)
        setArticles(arts)
        setIssueArticleLinks(links)
        setRequests(req)
        setResponses(resp)
        setCompiled(comp)
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'Failed to load data')
      })
  }, [])

  useEffect(() => {
    const conventionId = filters.convention || undefined
    void Promise.all([
      fetchReportArticles(conventionId),
      fetchReportIssueArticleLinks(conventionId),
    ])
      .then(([arts, links]) => {
        setArticles(arts)
        setIssueArticleLinks(links)
      })
      .catch(() => {
        /* keep prior lists on refresh failure */
      })
  }, [filters.convention])

  useEffect(() => {
    void fetchReportIndicators({
      conventionId: filters.convention || undefined,
      articleId: filters.articleId || undefined,
      entryKind: filters.entryKind || undefined,
      categoryId: filters.categoryId || undefined,
    })
      .then(setIndicators)
      .catch(() => {
        /* keep prior list on refresh failure */
      })
  }, [filters.convention, filters.articleId, filters.entryKind, filters.categoryId])

  useEffect(() => {
    if (!filters.indicatorId) return
    if (indicators.some((i) => String(i.id) === filters.indicatorId)) return
    setFilters((prev) => ({ ...prev, indicatorId: '' }))
  }, [indicators, filters.indicatorId])

  const articleOptions = useMemo(() => {
    const list = filters.convention
      ? articles.filter((a) => String(a.convention_id) === filters.convention)
      : articles
    return list.map((a) => ({ value: String(a.id), label: a.article_name }))
  }, [articles, filters.convention])

  const indicatorSelectOptions = useMemo(
    () => indicators.map((i) => ({ value: String(i.id), label: i.indicator_text })),
    [indicators],
  )

  const categorySelectOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name })),
    [categories],
  )

  useEffect(() => {
    if (!filters.articleId) return
    if (articleOptions.some((a) => a.value === filters.articleId)) return
    setFilters((prev) => ({ ...prev, articleId: '', indicatorId: '' }))
  }, [articleOptions, filters.articleId])

  useEffect(() => {
    if (!filters.categoryId) return
    if (categorySelectOptions.some((c) => c.value === filters.categoryId)) return
    setFilters((prev) => ({ ...prev, categoryId: '', indicatorId: '' }))
  }, [categorySelectOptions, filters.categoryId])

  const filtersAreApplied = useMemo(
    () => reportFiltersAreApplied(filters, defaultFilters),
    [filters, defaultFilters],
  )

  const reportFilters = useMemo(
    (): ReportFilters => ({
      ...filters,
      dataSource: COMPILED_DATA_SOURCE,
      regionId: lockedRegionalId || filters.regionId,
    }),
    [filters, lockedRegionalId],
  )

  const yearOptions = useMemo(() => {
    const current = now.getFullYear()
    return Array.from({ length: 12 }, (_, i) => String(current - i))
  }, [])

  function handleResetFilters() {
    setFilters(createDefaultReportFilters(lockedRegionalId))
    setDashboardResult(null)
  }

  async function handleGenerateDashboard() {
    setReportLoading(true)
    try {
      const rankingIndicators = await fetchReportIndicators({
        conventionId: reportFilters.convention || undefined,
        articleId: reportFilters.articleId || undefined,
        entryKind: reportFilters.entryKind || undefined,
        categoryId: reportFilters.categoryId || undefined,
      })
      const result = buildReportingDashboard(requests, responses, compiled, reportFilters, {
        conventions,
        categories,
        regions,
        articles,
        indicators: rankingIndicators,
        issueArticleLinks,
      })
      setDashboardResult(result)
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to build dashboard')
    } finally {
      setReportLoading(false)
    }
  }

  async function handleExportPdf() {
    if (!dashboardResult || !exportRef.current) return
    setPdfLoading(true)
    try {
      await downloadElementAsPdf(exportRef.current, 'reporting-dashboard', {
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
      titleIcon={<LayoutDashboard size={26} color="var(--solid-blue)" aria-hidden />}
      title="Reporting dashboard"
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
                <label htmlFor="rg-convention">Convention</label>
                <select
                  id="rg-convention"
                  value={filters.convention}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      convention: e.target.value,
                      articleId: '',
                      indicatorId: '',
                    })
                  }
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
                <label htmlFor="rg-article">Article</label>
                <select
                  id="rg-article"
                  value={filters.articleId}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      articleId: e.target.value,
                      indicatorId: '',
                    })
                  }
                >
                  <option value="">All articles</option>
                  {articleOptions.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
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
                      indicatorId: '',
                    })
                  }
                >
                  <option value="">All</option>
                  <option value="issue">{LOI_LABEL}</option>
                  <option value="recommendation">{CONCLUDING_OBSERVATIONS_LABEL}</option>
                </select>
              </div>

              <div className="report-generator__field">
                <label htmlFor="rg-indicator">Indicator</label>
                <SearchableSelect
                  id="rg-indicator"
                  className="report-generator__searchable-select"
                  value={filters.indicatorId}
                  onChange={(v) => setFilters({ ...filters, indicatorId: v })}
                  options={indicatorSelectOptions}
                  placeholder="All indicators"
                  emptyFilterMessage="No indicators match your search"
                />
              </div>

              <div className="report-generator__field">
                <label htmlFor="rg-category">Categories</label>
                <SearchableSelect
                  id="rg-category"
                  className="report-generator__searchable-select"
                  value={filters.categoryId}
                  onChange={(v) =>
                    setFilters({
                      ...filters,
                      categoryId: v,
                      indicatorId: '',
                    })
                  }
                  options={categorySelectOptions}
                  placeholder="All categories"
                  emptyFilterMessage="No categories match your search"
                />
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
              <Button
                variant="secondary"
                compact
                onClick={handleResetFilters}
                disabled={reportLoading || (!filtersAreApplied && !dashboardResult)}
                title="Reset filters"
              >
                <RotateCcw size={16} aria-hidden />
                Reset filters
              </Button>
              <Button variant="primary" compact onClick={() => void handleGenerateDashboard()} disabled={reportLoading}>
                <BarChart2 size={16} aria-hidden />
                {reportLoading ? 'Loading…' : 'Apply filters'}
              </Button>
            </div>
          </div>

          {dashboardResult ? (
            <div ref={exportRef} className="report-generator__results report-generator__results--full reporting-dashboard">
              <div className="reporting-dashboard__toolbar">
                <ReportingFilterSummary parts={dashboardResult.filterSummaryParts} />
                <div className="reporting-dashboard__toolbar-actions">
                  <Button variant="primary" compact onClick={() => void handleExportPdf()} disabled={pdfLoading}>
                    <FileText size={16} aria-hidden />
                    {pdfLoading ? 'Saving PDF…' : 'Save to PDF'}
                  </Button>
                </div>
              </div>

              {dashboardResult.indicatorFocusMode ? (
                <ReportingIndicatorCompiledFocus
                  indicatorId={Number(dashboardResult.focusedIndicatorId)}
                  indicatorLabel={dashboardResult.focusedIndicatorLabel}
                  records={dashboardResult.indicatorFocusCompiled}
                />
              ) : (
                <>
                  <ReportingSummaryCards cards={dashboardResult.summaryCards} />

                  <div className="reporting-dashboard__row reporting-dashboard__row--top">
                    <div className="report-generator__chart-panel reporting-dashboard__panel">
                      <h4 className="chart-caption">Records status</h4>
                      <MultiColorBarChart
                        data={dashboardResult.recordStatusBar}
                        emptyMessage="No records for the current filters."
                      />
                    </div>
                    <div className="report-generator__chart-panel reporting-dashboard__panel">
                      <h4 className="chart-caption">{issueEntryTitleColumnLabel()}</h4>
                      <DonutChartPanel data={dashboardResult.entryKindPie} title={issueEntryTitleColumnLabel()} />
                    </div>
                    <div className="report-generator__chart-panel reporting-dashboard__panel">
                      <h4 className="chart-caption">Records by region</h4>
                      <MultiColorBarChart
                        data={dashboardResult.regionBar}
                        emptyMessage="No regional compiled records for the current filters."
                      />
                    </div>
                  </div>

                  <div className="reporting-dashboard__row reporting-dashboard__row--bottom">
                    <div className="report-generator__chart-panel reporting-dashboard__panel reporting-dashboard__panel--rank">
                      <ReportingRankPanel
                        title="Categories — top 10"
                        rows={dashboardResult.topCategories}
                        variant="categories"
                      />
                    </div>
                    <div className="report-generator__chart-panel reporting-dashboard__panel reporting-dashboard__panel--rank">
                      <ReportingRankPanel title="Indicators — top 10" rows={dashboardResult.topIndicators} />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="report-generator__empty">
              {reportLoading ? (
                <div className="report-generator__loading-pulse">
                  <div className="report-generator__loading-dot" />
                  <div className="report-generator__loading-bar" style={{ width: 256 }} />
                  <p className="report-generator__loading-msg">Building reporting dashboard…</p>
                </div>
              ) : (
                <div className="report-generator__empty-inner">
                  <LayoutDashboard size={56} style={{ opacity: 0.35 }} aria-hidden />
                  <h4>Configure filters and apply</h4>
                  <p>
                    View compiled-data insights by convention, article, {issueEntryTitleColumnLabel().toLowerCase()},
                    category, indicator, and date range. Select a specific indicator to see only its compiled
                    records.
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
