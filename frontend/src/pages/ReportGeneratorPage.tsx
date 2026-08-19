import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  BarChart2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  PieChart as PieChartIcon,
  RotateCcw,
  Settings,
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
  fetchReportSummary,
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
  collectionYearOptionsFromIndicators,
  type ReportChartPoint,
  type ReportFilterSummaryPart,
  type ReportFilters,
  type ReportRankRow,
  type ReportingDashboardResult,
  type ReportingDashboardSummaryCards,
} from '../lib/reportGeneratorData'
import { reportDashboardChartColor, reportTop10BarColor } from '../lib/reportChartTheme'
import { downloadElementAsPdf } from '../lib/downloadElementAsPdf'
import { LABEL_REPORTING_DASHBOARD } from '../lib/uiLabels'
import { isFederalAdmin, isRegionalAdmin, isSuperAdmin } from '../lib/roles'
import { ReportingIndicatorCompiledFocus } from '../components/ReportingIndicatorCompiledFocus'
import { Button } from '../components/ui/Button'
import { PageSection } from '../components/ui/PageSection'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { StatsCards } from '../components/ui/StatsCards'

const COMPILED_DATA_SOURCE: ReportFilters['dataSource'] = 'consolidated'

function createDefaultReportFilters(lockedRegionalId: string): ReportFilters {
  return {
    dataSource: COMPILED_DATA_SOURCE,
    regionId: lockedRegionalId,
    convention: '',
    articleId: '',
    entryKind: '',
    categoryId: '',
    indicatorId: '',
    collectionYearId: '',
  }
}

function reportFiltersAreApplied(current: ReportFilters, defaults: ReportFilters): boolean {
  return (
    current.convention !== defaults.convention ||
    current.articleId !== defaults.articleId ||
    current.entryKind !== defaults.entryKind ||
    current.categoryId !== defaults.categoryId ||
    current.indicatorId !== defaults.indicatorId ||
    current.collectionYearId !== defaults.collectionYearId ||
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
  reverseColors = false,
}: {
  title: string
  rows: ReportRankRow[]
  /** Indicators use the reverse of the Categories top-10 palette. */
  reverseColors?: boolean
}) {
  return (
    <div className="reporting-rank-panel">
      <h4 className="reporting-rank-panel__title">{title}</h4>
      {rows.length === 0 ? (
        <p className="muted reporting-dashboard__chart-empty">No data for the current filters.</p>
      ) : (
        <div className="reporting-rank-panel__list">
          {rows.map((row, index) => (
            <div key={row.id} className="reporting-rank-row reporting-rank-row--label-only">
              <span className="reporting-rank-row__label" title={row.label}>
                {row.label}
              </span>
              <div className="reporting-rank-row__bar-track">
                <div
                  className="reporting-rank-row__bar-fill"
                  style={{
                    width: `${row.barPercent}%`,
                    background: reportTop10BarColor(index, reverseColors),
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
        {
          label: 'Articles',
          value: cards.articles,
          icon: <FileText size={20} aria-hidden />,
          iconTone: '#2563eb',
        },
        {
          label: LOI_LABEL,
          value: cards.loiCount,
          detail: `${cards.loiIndicatorCount} indicator${cards.loiIndicatorCount === 1 ? '' : 's'}`,
          icon: <ClipboardList size={20} aria-hidden />,
          iconTone: '#16a34a',
        },
        {
          label: CONCLUDING_OBSERVATIONS_LABEL,
          value: cards.concludingCount,
          detail: `${cards.concludingIndicatorCount} indicator${cards.concludingIndicatorCount === 1 ? '' : 's'}`,
          icon: <ClipboardCheck size={20} aria-hidden />,
          iconTone: '#7c3aed',
        },
        {
          label: 'Categories',
          value: cards.categoriesCount,
          icon: <LayoutGrid size={20} aria-hidden />,
          iconTone: '#ea580c',
        },
        {
          label: 'Response Rate',
          value: `${cards.responsePercent}%`,
          detail: `${cards.requestsWithResponse} of ${cards.requestCount} request${cards.requestCount === 1 ? '' : 's'} · ${cards.responseCount} response${cards.responseCount === 1 ? '' : 's'}`,
          icon: <PieChartIcon size={20} aria-hidden />,
          iconTone: '#0d9488',
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

  const conventionSelected = Boolean(filters.convention)

  const collectionYearOptions = useMemo(
    () => collectionYearOptionsFromIndicators(indicators),
    [indicators],
  )

  useEffect(() => {
    if (!filters.collectionYearId) return
    if (collectionYearOptions.some((y) => String(y.id) === filters.collectionYearId)) return
    setFilters((prev) => ({ ...prev, collectionYearId: '' }))
  }, [collectionYearOptions, filters.collectionYearId])

  function handleResetFilters() {
    setFilters(createDefaultReportFilters(lockedRegionalId))
    setDashboardResult(null)
  }

  async function handleGenerateDashboard() {
    setReportLoading(true)
    try {
      const [rankingIndicators, catalogSummary] = await Promise.all([
        fetchReportIndicators({
          conventionId: reportFilters.convention || undefined,
          articleId: reportFilters.articleId || undefined,
          entryKind: reportFilters.entryKind || undefined,
          categoryId: reportFilters.categoryId || undefined,
        }),
        fetchReportSummary({
          conventionId: reportFilters.convention || undefined,
          articleId: reportFilters.articleId || undefined,
          entryKind: reportFilters.entryKind || undefined,
          categoryId: reportFilters.categoryId || undefined,
          collectionYearId: reportFilters.collectionYearId || undefined,
        }),
      ])
      const result = buildReportingDashboard(requests, responses, compiled, reportFilters, {
        conventions,
        categories,
        regions,
        articles,
        indicators: rankingIndicators,
        issueArticleLinks,
      })
      if (!result.indicatorFocusMode) {
        result.summaryCards = {
          ...result.summaryCards,
          articles: catalogSummary.articles,
          categoriesCount: catalogSummary.categories,
          loiCount: catalogSummary.loi_count,
          loiIndicatorCount: catalogSummary.loi_indicator_count,
          concludingCount: catalogSummary.concluding_count,
          concludingIndicatorCount: catalogSummary.concluding_indicator_count,
        }
      }
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
        headerTitle: 'Reporting dashboard',
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
      title={LABEL_REPORTING_DASHBOARD}
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
                      entryKind: '',
                      categoryId: '',
                      indicatorId: '',
                      collectionYearId: '',
                    })
                  }
                >
                  <option value="">Select a convention</option>
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
                  disabled={!conventionSelected}
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
                  disabled={!conventionSelected}
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
                <label htmlFor="rg-category">Categories</label>
                <SearchableSelect
                  id="rg-category"
                  className="report-generator__searchable-select"
                  value={filters.categoryId}
                  disabled={!conventionSelected}
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

              <div className="report-generator__field">
                <label htmlFor="rg-indicator">Indicator</label>
                <SearchableSelect
                  id="rg-indicator"
                  className="report-generator__searchable-select"
                  value={filters.indicatorId}
                  disabled={!conventionSelected}
                  onChange={(v) => setFilters({ ...filters, indicatorId: v })}
                  options={indicatorSelectOptions}
                  placeholder="All indicators"
                  emptyFilterMessage="No indicators match your search"
                />
              </div>

              <div className="report-generator__field">
                <label htmlFor="rg-year">Year</label>
                <select
                  id="rg-year"
                  value={filters.collectionYearId}
                  onChange={(e) => setFilters({ ...filters, collectionYearId: e.target.value })}
                  disabled={!conventionSelected || collectionYearOptions.length === 0}
                >
                  <option value="">All years</option>
                  {collectionYearOptions.map((y) => (
                    <option key={y.id} value={String(y.id)}>
                      {y.label}
                    </option>
                  ))}
                </select>
              </div>
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
              <Button
                variant="primary"
                compact
                onClick={() => void handleGenerateDashboard()}
                disabled={reportLoading || !conventionSelected}
                title={conventionSelected ? undefined : 'Select a convention first'}
              >
                <BarChart2 size={16} aria-hidden />
                {reportLoading ? 'Loading…' : 'Apply filters'}
              </Button>
            </div>
            {!conventionSelected ? (
              <p className="muted report-generator__hint">
                Select a convention to enable the other filters and load its dashboard.
              </p>
            ) : null}
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
                  filterYearId={dashboardResult.focusedYearId}
                  filterYearLabel={dashboardResult.focusedYearLabel}
                />
              ) : (
                <>
                  <ReportingSummaryCards cards={dashboardResult.summaryCards} />

                  <div className="reporting-dashboard__row reporting-dashboard__row--top">
                    <div className="report-generator__chart-panel reporting-dashboard__panel">
                      <h4 className="chart-caption">Records Status</h4>
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
                      />
                    </div>
                    <div className="report-generator__chart-panel reporting-dashboard__panel reporting-dashboard__panel--rank">
                      <ReportingRankPanel
                        title="Indicators — top 10"
                        rows={dashboardResult.topIndicators}
                        reverseColors
                      />
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
