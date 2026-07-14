import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  BarChart2,
  LayoutDashboard,
  RotateCcw,
  Settings,
} from 'lucide-react'
import { fetchDepartmentTasks } from '../api/lists'
import {
  fetchReportConventions,
  fetchReportIndicators,
  fetchReportIssueCategories,
  type ReportLookupIndicator,
} from '../api/reports'
import { useAuth } from '../auth/AuthContext'
import { GovernancePrefixedChartsSection } from '../components/governance/GovernancePrefixedChartsSection'
import { GovernanceTrendChartPanel } from '../components/governance/GovernanceTrendChartPanel'
import { Button } from '../components/ui/Button'
import { PageSection } from '../components/ui/PageSection'
import { SearchableMultiSelect } from '../components/ui/SearchableMultiSelect'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import {
  buildIndicatorGenderTrendSeries,
  type GovernanceFilters,
  type IndicatorTrendSeries,
} from '../lib/governanceDashboardData'
import {
  prefixedIndicatorIds,
  resolvePrefixedCharts,
} from '../lib/governancePrefixedCharts'
import { buildGovernanceTrendChartRows } from '../lib/governanceTrendCharts'
import {
  CONCLUDING_OBSERVATIONS_LABEL,
  LOI_LABEL,
  issueEntryTitleColumnLabel,
} from '../lib/issueEntryKind'
import { isFederalAdmin, isRegionalAdmin, isSuperAdmin } from '../lib/roles'
import { LABEL_GOVERNANCE_DASHBOARD } from '../lib/uiLabels'

function createDefaultFilters(): GovernanceFilters {
  return {
    convention: '',
    entryKind: '',
    categoryId: '',
    indicatorIds: [],
  }
}

function filtersAreDirty(current: GovernanceFilters, defaults: GovernanceFilters): boolean {
  return (
    current.convention !== defaults.convention ||
    current.entryKind !== defaults.entryKind ||
    current.categoryId !== defaults.categoryId ||
    current.indicatorIds.length > 0
  )
}

export function GovernanceDashboardPage() {
  const { user } = useAuth()
  const federalPortal = isFederalAdmin(user) || isSuperAdmin(user)
  const regionalPortal = isRegionalAdmin(user)
  const canAccess = Boolean(user && (federalPortal || regionalPortal))

  const lockedRegionalId =
    regionalPortal && user?.region?.id != null ? user.region.id : null

  const defaults = useMemo(() => createDefaultFilters(), [])
  const [filters, setFilters] = useState<GovernanceFilters>(createDefaultFilters)
  const [conventions, setConventions] = useState<
    Awaited<ReturnType<typeof fetchReportConventions>>
  >([])
  const [categories, setCategories] = useState<
    Awaited<ReturnType<typeof fetchReportIssueCategories>>
  >([])
  const [indicators, setIndicators] = useState<ReportLookupIndicator[]>([])
  const [allIndicators, setAllIndicators] = useState<ReportLookupIndicator[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [defaultLoading, setDefaultLoading] = useState(true)
  const [trendSeries, setTrendSeries] = useState<IndicatorTrendSeries[] | null>(null)
  const [prefixedSeries, setPrefixedSeries] = useState<IndicatorTrendSeries[]>([])

  useEffect(() => {
    void Promise.all([
      fetchReportConventions(),
      fetchReportIssueCategories(),
      fetchReportIndicators({}),
    ])
      .then(([conv, cats, inds]) => {
        setConventions(conv)
        setCategories(cats)
        setAllIndicators(inds)
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'Failed to load data')
      })
  }, [])

  useEffect(() => {
    void fetchReportIndicators({
      conventionId: filters.convention || undefined,
      entryKind: filters.entryKind || undefined,
      categoryId: filters.categoryId || undefined,
    })
      .then(setIndicators)
      .catch(() => {
        /* keep prior list on refresh failure */
      })
  }, [filters.convention, filters.entryKind, filters.categoryId])

  useEffect(() => {
    const allowed = new Set(indicators.map((i) => String(i.id)))
    setFilters((prev) => {
      const nextIds = prev.indicatorIds.filter((id) => allowed.has(id))
      if (nextIds.length === prev.indicatorIds.length) return prev
      return { ...prev, indicatorIds: nextIds }
    })
  }, [indicators])

  const conventionSelected = Boolean(filters.convention)

  const categorySelectOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name })),
    [categories],
  )

  const indicatorSelectOptions = useMemo(
    () => indicators.map((i) => ({ value: String(i.id), label: i.indicator_text })),
    [indicators],
  )

  useEffect(() => {
    if (!filters.categoryId) return
    if (categorySelectOptions.some((c) => c.value === filters.categoryId)) return
    setFilters((prev) => ({ ...prev, categoryId: '', indicatorIds: [] }))
  }, [categorySelectOptions, filters.categoryId])

  const prefixedCharts = useMemo(
    () => resolvePrefixedCharts(allIndicators),
    [allIndicators],
  )

  const prefixedSeriesById = useMemo(() => {
    const map = new Map<string, IndicatorTrendSeries>()
    for (const s of prefixedSeries) map.set(String(s.indicatorId), s)
    return map
  }, [prefixedSeries])

  /** Mode 1 = filters applied; Mode 2 = default prefixed charts. */
  const showDynamicMode = trendSeries != null

  useEffect(() => {
    if (allIndicators.length === 0) return

    let cancelled = false
    setDefaultLoading(true)

    void (async () => {
      try {
        const resolved = resolvePrefixedCharts(allIndicators)
        const ids = prefixedIndicatorIds(resolved)
        if (ids.length === 0) {
          if (!cancelled) setPrefixedSeries([])
          return
        }

        const deptTasks = await fetchDepartmentTasks(
          federalPortal ? { scope: 'all' } : undefined,
        )
        if (cancelled) return

        const scopedTasks =
          lockedRegionalId == null
            ? deptTasks
            : deptTasks.filter((t) => Number(t.region_id) === Number(lockedRegionalId))

        const meta = allIndicators.filter((i) => ids.includes(String(i.id)))
        const series = buildIndicatorGenderTrendSeries(scopedTasks, meta, ids)
        if (!cancelled) setPrefixedSeries(series)
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load default trend charts')
          setPrefixedSeries([])
        }
      } finally {
        if (!cancelled) setDefaultLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [allIndicators, federalPortal, lockedRegionalId])

  const dirty = filtersAreDirty(filters, defaults)
  const canApply = filters.indicatorIds.length > 0

  const trendChartRows = useMemo(
    () => (trendSeries ? buildGovernanceTrendChartRows(trendSeries) : []),
    [trendSeries],
  )

  function handleResetFilters() {
    setFilters(createDefaultFilters())
    setTrendSeries(null)
    setLoadError(null)
  }

  async function handleApplyFilters() {
    if (!canApply) return
    setChartLoading(true)
    setLoadError(null)
    try {
      const deptTasks = await fetchDepartmentTasks(
        federalPortal ? { scope: 'all' } : undefined,
      )
      const scopedTasks =
        lockedRegionalId == null
          ? deptTasks
          : deptTasks.filter((t) => Number(t.region_id) === Number(lockedRegionalId))

      const selectedMeta = indicators.filter((i) =>
        filters.indicatorIds.includes(String(i.id)),
      )
      const series = buildIndicatorGenderTrendSeries(
        scopedTasks,
        selectedMeta.length > 0 ? selectedMeta : indicators,
        filters.indicatorIds,
      )
      setTrendSeries(series)
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to build trend charts')
      setTrendSeries(null)
    } finally {
      setChartLoading(false)
    }
  }

  if (!canAccess) {
    return <Navigate to="/" replace />
  }

  return (
    <PageSection
      titleIcon={<LayoutDashboard size={26} color="var(--solid-blue)" aria-hidden />}
      title={LABEL_GOVERNANCE_DASHBOARD}
    >
      <div className="report-generator-page">
        {loadError ? <p className="login-error">{loadError}</p> : null}

        <div className="report-generator">
          <div className="report-generator__card report-generator__card--config">
            <h3 className="report-generator__card-title">
              <Settings size={20} aria-hidden /> Report filters
            </h3>
            <div className="report-generator__grid-filters governance-dashboard__filters">
              <div className="governance-dashboard__filters-row governance-dashboard__filters-row--primary">
                <div className="report-generator__field">
                  <label htmlFor="gd-convention">Convention</label>
                  <select
                    id="gd-convention"
                    value={filters.convention}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        convention: e.target.value,
                        entryKind: '',
                        categoryId: '',
                        indicatorIds: [],
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
                  <label htmlFor="gd-entry-kind">{issueEntryTitleColumnLabel()}</label>
                  <select
                    id="gd-entry-kind"
                    value={filters.entryKind}
                    disabled={!conventionSelected}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        entryKind: e.target.value as GovernanceFilters['entryKind'],
                        indicatorIds: [],
                      })
                    }
                  >
                    <option value="">All</option>
                    <option value="issue">{LOI_LABEL}</option>
                    <option value="recommendation">{CONCLUDING_OBSERVATIONS_LABEL}</option>
                  </select>
                </div>

                <div className="report-generator__field">
                  <label htmlFor="gd-category">Categories</label>
                  <SearchableSelect
                    id="gd-category"
                    className="report-generator__searchable-select"
                    value={filters.categoryId}
                    disabled={!conventionSelected}
                    onChange={(v) =>
                      setFilters({
                        ...filters,
                        categoryId: v,
                        indicatorIds: [],
                      })
                    }
                    options={categorySelectOptions}
                    placeholder="All categories"
                    emptyFilterMessage="No categories match your search"
                  />
                </div>
              </div>

              <div className="governance-dashboard__filters-row governance-dashboard__filters-row--indicators">
                <div className="report-generator__field report-generator__field--full">
                  <label htmlFor="gd-indicators">Indicators</label>
                  <SearchableMultiSelect
                    id="gd-indicators"
                    className="report-generator__searchable-select"
                    values={filters.indicatorIds}
                    disabled={!conventionSelected}
                    onChange={(ids) => setFilters({ ...filters, indicatorIds: ids })}
                    options={indicatorSelectOptions}
                    placeholder="Select indicators"
                    emptyFilterMessage="No indicators match your search"
                    selectedSummary={(count, firstLabel) =>
                      count === 1 && firstLabel
                        ? firstLabel
                        : `${count} indicators selected`
                    }
                  />
                </div>
              </div>
            </div>

            <div className="report-generator__actions">
              <Button
                variant="secondary"
                compact
                onClick={handleResetFilters}
                disabled={chartLoading || (!dirty && !trendSeries)}
                title="Reset filters"
              >
                <RotateCcw size={16} aria-hidden />
                Reset filters
              </Button>
              <Button
                variant="primary"
                compact
                onClick={() => void handleApplyFilters()}
                disabled={chartLoading || !canApply}
                title={
                  canApply
                    ? undefined
                    : 'Select at least one indicator to apply filters'
                }
              >
                <BarChart2 size={16} aria-hidden />
                {chartLoading ? 'Loading…' : 'Apply filters'}
              </Button>
            </div>
            {!conventionSelected ? (
              <p className="muted report-generator__hint">
                Default CAT indicator trends are shown below. Select a convention and indicators,
                then Apply filters for a custom view.
              </p>
            ) : !canApply ? (
              <p className="muted report-generator__hint">
                Select at least one indicator to enable Apply filters and load custom trend charts.
              </p>
            ) : null}
          </div>

          {showDynamicMode ? (
            <div className="report-generator__results report-generator__results--full reporting-dashboard">
              <h3 className="cat-static-trend-dashboard__title">Indicator Trends</h3>
              {trendSeries.length === 0 ? (
                <p className="muted">No indicators selected.</p>
              ) : (
                <div className="governance-dashboard__chart-rows">
                  {trendChartRows.map((row) => (
                    <div key={row.key} className="governance-dashboard__chart-row">
                      {row.items.map((item) => (
                        <GovernanceTrendChartPanel key={item.indicatorId} item={item} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <GovernancePrefixedChartsSection
              charts={prefixedCharts}
              seriesById={prefixedSeriesById}
              loading={defaultLoading || chartLoading}
            />
          )}
        </div>
      </div>
    </PageSection>
  )
}
