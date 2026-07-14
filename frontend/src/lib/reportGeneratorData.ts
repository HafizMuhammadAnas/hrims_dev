import type { CompiledRecordRow, RegionalResponseRow } from '../api/lists'
import type { ReportLookupArticle, ReportLookupCategory, ReportLookupConvention, ReportLookupIndicator } from '../api/reports'
import type { RegionRow } from '../api/regions'
import { sortCollectionYearsByLabelValue } from './collectionYearSort'
import {
  CONCLUDING_OBSERVATIONS_LABEL,
  LOI_LABEL,
  coerceIssueEntryKind,
  issueEntryKindBadgeLabel,
  issueEntryPrimaryText,
} from './issueEntryKind'
import { LABEL_LOI_OBSERVATION_TITLE, LABEL_TOTAL_RECORDS } from './uiLabels'
import type { HrRequestRow } from '../types/hrRequest'

export type ReportDataSource = 'requests' | 'responses' | 'consolidated'

export type ReportEntryKindFilter = '' | 'issue' | 'recommendation'

export type ReportFilters = {
  dataSource: ReportDataSource
  regionId: string
  convention: string
  articleId: string
  entryKind: ReportEntryKindFilter
  categoryId: string
  indicatorId: string
  /** Collection year id (from indicator disaggregated data). Empty = all years. */
  collectionYearId: string
}

export type ReportSummaryMetric = {
  label: string
  value: string | number
}

export type ReportChartPoint = {
  name: string
  value: number
}

export type ReportTimelinePoint = {
  name: string
  count: number
}

export type ReportInsightChart = {
  id: string
  title: string
  type: 'pie' | 'bar' | 'line' | 'area'
  points: ReportChartPoint[]
  timeline?: ReportTimelinePoint[]
}

export type ReportTableRow = Record<string, string | number | null>

export type ReportRankRow = {
  id: string
  shortLabel: string
  label: string
  count: number
  /** Share of total (displayed as NN%). */
  percent: number
  /** Width of progress bar relative to top row (0–100). */
  barPercent: number
}

export type ReportCompiledFocusRow = {
  id: string
  title: string
  status: string
  compilationDate: string
  submissionDate: string
  regions: string
  summary: string
}

export type ReportFilterSummaryPart = {
  label: string
  value: string
}

export type ReportingDashboardSummaryCards = {
  articles: number
  loiCount: number
  loiIndicatorCount: number
  concludingCount: number
  concludingIndicatorCount: number
  categoriesCount: number
  requestCount: number
  responseCount: number
  requestsWithResponse: number
  responsePercent: number
}

export type ReportingDashboardResult = {
  filterSummary: string
  filterSummaryParts: ReportFilterSummaryPart[]
  indicatorFocusMode: boolean
  focusedIndicatorId?: string
  focusedIndicatorLabel?: string
  focusedYearId?: number
  focusedYearLabel?: string
  indicatorFocusCompiled: CompiledRecordRow[]
  summaryCards: ReportingDashboardSummaryCards
  recordStatusBar: ReportChartPoint[]
  entryKindPie: ReportChartPoint[]
  regionBar: ReportChartPoint[]
  topCategories: ReportRankRow[]
  topIndicators: ReportRankRow[]
  indicatorCompiledRows: ReportCompiledFocusRow[]
}

export type ReportBuildResult = {
  title: string
  filterSummary: string
  metrics: ReportSummaryMetric[]
  charts: ReportInsightChart[]
  tableHeaders: string[]
  tableRows: ReportTableRow[]
}

function regionNamesOfRequest(r: HrRequestRow): string {
  if (r.regions?.length) return r.regions.map((x) => x.name).join('; ')
  return r.region_name ?? r.region?.name ?? ''
}

function departmentNamesOfRequest(r: HrRequestRow): string {
  return r.departments?.map((d) => d.name).join('; ') ?? ''
}

function requestMatchesRegion(r: HrRequestRow, regionId: string): boolean {
  if (!regionId) return true
  const id = Number(regionId)
  if (r.regions?.some((x) => x.id === id)) return true
  if (r.region_id === id || r.region?.id === id) return true
  return false
}

function matchesConvention(r: HrRequestRow, convention: string): boolean {
  if (!convention) return true
  return String(r.convention_id ?? r.convention?.id ?? '') === convention
}

function matchesEntryKind(r: HrRequestRow, entryKind: ReportEntryKindFilter): boolean {
  if (!entryKind) return true
  return coerceIssueEntryKind(r.issue?.entry_kind) === entryKind
}

function matchesCategory(r: HrRequestRow, categoryId: string): boolean {
  if (!categoryId) return true
  return String(r.issue?.category?.id ?? '') === categoryId
}

function buildIssueArticleMap(links: Array<{ issue_id: number; article_id: number }>): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>()
  for (const link of links) {
    const set = map.get(link.issue_id) ?? new Set<number>()
    set.add(link.article_id)
    map.set(link.issue_id, set)
  }
  return map
}

function buildIndicatorIssueMap(indicators: ReportLookupIndicator[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const ind of indicators) {
    map.set(ind.id, ind.issue_id)
  }
  return map
}

/** issue_id -> set of collection year ids used by that issue's indicators. */
function buildIssueYearMap(indicators: ReportLookupIndicator[]): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>()
  for (const ind of indicators) {
    if (!ind.collection_years?.length) continue
    const set = map.get(ind.issue_id) ?? new Set<number>()
    for (const y of ind.collection_years) set.add(y.id)
    map.set(ind.issue_id, set)
  }
  return map
}

/** Distinct collection years across indicators, sorted by year value ascending. */
export function collectionYearOptionsFromIndicators(
  indicators: ReportLookupIndicator[],
): Array<{ id: number; label: string }> {
  const byId = new Map<number, string>()
  for (const ind of indicators) {
    for (const y of ind.collection_years ?? []) {
      if (!byId.has(y.id)) byId.set(y.id, y.label)
    }
  }
  return sortCollectionYearsByLabelValue(
    [...byId.entries()].map(([id, label]) => ({ id, label })),
  )
}

function matchesYear(
  r: HrRequestRow,
  collectionYearId: string,
  issueYearMap: Map<number, Set<number>>,
): boolean {
  if (!collectionYearId) return true
  if (r.issue_id == null) return false
  const years = issueYearMap.get(Number(r.issue_id))
  return years?.has(Number(collectionYearId)) ?? false
}

function matchesArticle(
  r: HrRequestRow,
  articleId: string,
  issueArticleMap: Map<number, Set<number>>,
): boolean {
  if (!articleId) return true
  if (r.issue_id == null) return false
  const arts = issueArticleMap.get(Number(r.issue_id))
  return arts?.has(Number(articleId)) ?? false
}

function matchesIndicator(
  r: HrRequestRow,
  indicatorId: string,
  indicatorIssueMap: Map<number, number>,
): boolean {
  if (!indicatorId) return true
  const indId = Number(indicatorId)
  const issueId = indicatorIssueMap.get(indId)
  return issueId != null && r.issue_id != null && Number(r.issue_id) === issueId
}

function requestMatchesCatalogFilters(
  r: HrRequestRow,
  f: ReportFilters,
  issueArticleMap: Map<number, Set<number>>,
  indicatorIssueMap: Map<number, number>,
): boolean {
  if (!matchesConvention(r, f.convention)) return false
  if (!matchesEntryKind(r, f.entryKind)) return false
  if (!matchesCategory(r, f.categoryId)) return false
  if (!matchesArticle(r, f.articleId, issueArticleMap)) return false
  if (!matchesIndicator(r, f.indicatorId, indicatorIssueMap)) return false
  return true
}

function filterRequests(
  requests: HrRequestRow[],
  f: ReportFilters,
  issueArticleMap: Map<number, Set<number>>,
  indicatorIssueMap: Map<number, number>,
  issueYearMap: Map<number, Set<number>>,
): HrRequestRow[] {
  return requests.filter((r) => {
    if (!requestMatchesRegion(r, f.regionId)) return false
    if (!requestMatchesCatalogFilters(r, f, issueArticleMap, indicatorIssueMap)) return false
    if (!matchesYear(r, f.collectionYearId, issueYearMap)) return false
    return true
  })
}

function filterResponses(
  responses: RegionalResponseRow[],
  requests: HrRequestRow[],
  f: ReportFilters,
  issueArticleMap: Map<number, Set<number>>,
  indicatorIssueMap: Map<number, number>,
  issueYearMap: Map<number, Set<number>>,
): RegionalResponseRow[] {
  const reqById = new Map(requests.map((r) => [r.id, r]))
  return responses.filter((resp) => {
    if (f.regionId && String(resp.region_id ?? '') !== f.regionId) return false
    const req = reqById.get(resp.req_id)
    if (!req) return false
    if (!requestMatchesCatalogFilters(req, f, issueArticleMap, indicatorIssueMap)) return false
    if (!matchesYear(req, f.collectionYearId, issueYearMap)) return false
    return true
  })
}

function filterCompiled(
  compiled: CompiledRecordRow[],
  requests: HrRequestRow[],
  f: ReportFilters,
  regionsById: Map<number, RegionRow>,
  issueArticleMap: Map<number, Set<number>>,
  indicatorIssueMap: Map<number, number>,
  issueYearMap: Map<number, Set<number>>,
): CompiledRecordRow[] {
  const reqById = new Map(requests.map((r) => [r.id, r]))
  const regionName = f.regionId ? regionsById.get(Number(f.regionId))?.name : null
  const hasCatalogFilter =
    Boolean(f.convention) ||
    Boolean(f.entryKind) ||
    Boolean(f.categoryId) ||
    Boolean(f.articleId) ||
    Boolean(f.indicatorId) ||
    Boolean(f.collectionYearId)
  return compiled.filter((c) => {
    if (regionName && !c.region_names.some((n) => n === regionName)) return false
    if (!hasCatalogFilter) return true
    const req = c.req_id ? reqById.get(c.req_id) : undefined
    if (!req) return false
    if (!requestMatchesCatalogFilters(req, f, issueArticleMap, indicatorIssueMap)) return false
    if (!matchesYear(req, f.collectionYearId, issueYearMap)) return false
    return true
  })
}

function countMap(values: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const v of values) {
    const k = v.trim() || '—'
    map[k] = (map[k] ?? 0) + 1
  }
  return map
}

function mapToChartPoints(map: Record<string, number>, limit = 10): ReportChartPoint[] {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => ({
      name: name.length > 26 ? `${name.slice(0, 26)}…` : name,
      value,
    }))
}

function buildTimeline(rows: string[], months = 12): ReportTimelinePoint[] {
  const out: ReportTimelinePoint[] = []
  const d = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    const ym = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`
    const label = x.toLocaleString('default', { month: 'short', year: '2-digit' })
    out.push({
      name: label,
      count: rows.filter((date) => date.startsWith(ym)).length,
    })
  }
  return out
}

function formatStatusLabel(status: string): string {
  if (status === 'needs-modification') return 'Needs modification'
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ')
}

function linkedRequestFields(req: HrRequestRow | undefined): ReportTableRow {
  if (!req) {
    return {
      'Convention code': '—',
      'Convention name': '—',
      Type: '—',
      Category: '—',
      LABEL_LOI_OBSERVATION_TITLE: '—',
      'Request status': '—',
      'Request due date': '—',
    }
  }
  return {
    'Convention code': req.convention?.code ?? req.conv ?? '—',
    'Convention name': req.convention?.name ?? '—',
    Type: issueEntryKindBadgeLabel(coerceIssueEntryKind(req.issue?.entry_kind)),
    Category: req.issue?.category?.name ?? '—',
    LABEL_LOI_OBSERVATION_TITLE: req.issue ? issueEntryPrimaryText(req.issue) || '—' : '—',
    'Request status': formatStatusLabel(req.status),
    'Request due date': req.date || '—',
  }
}

function buildRankRows(
  entries: Array<{ id: string; shortLabel: string; label: string; count: number }>,
  limit = 10,
): ReportRankRow[] {
  const sorted = [...entries].sort((a, b) => b.count - a.count).slice(0, limit)
  const total = sorted.reduce((sum, row) => sum + row.count, 0)
  const max = sorted[0]?.count ?? 1
  return sorted.map((row) => ({
    ...row,
    percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
    barPercent: max > 0 ? Math.round((row.count / max) * 100) : 0,
  }))
}

function filtersForDashboardCharts(f: ReportFilters): ReportFilters {
  return { ...f, indicatorId: '' }
}

function buildSummaryCards(
  chartFr: HrRequestRow[],
  chartSr: RegionalResponseRow[],
  chartCr: CompiledRecordRow[],
  reqById: Map<string, HrRequestRow>,
  issueArticleMap: Map<number, Set<number>>,
  indicators: ReportLookupIndicator[],
): ReportingDashboardSummaryCards {
  const articleIds = new Set<number>()
  const categoryIds = new Set<string>()
  const loiIssueIds = new Set<number>()
  const concludingIssueIds = new Set<number>()

  for (const record of chartCr) {
    const req = record.req_id ? reqById.get(record.req_id) : undefined
    if (!req?.issue_id) continue

    const issueId = Number(req.issue_id)
    const entryKind = coerceIssueEntryKind(req.issue?.entry_kind)
    if (entryKind === 'issue') loiIssueIds.add(issueId)
    if (entryKind === 'recommendation') concludingIssueIds.add(issueId)

    const categoryId = req.issue?.category?.id
    if (categoryId != null) categoryIds.add(String(categoryId))

    const linkedArticles = issueArticleMap.get(issueId)
    if (linkedArticles) {
      for (const articleId of linkedArticles) articleIds.add(articleId)
    }
  }

  let loiIndicatorCount = 0
  let concludingIndicatorCount = 0
  for (const indicator of indicators) {
    if (loiIssueIds.has(indicator.issue_id)) loiIndicatorCount += 1
    if (concludingIssueIds.has(indicator.issue_id)) concludingIndicatorCount += 1
  }

  const requestCount = chartFr.length
  const responseCount = chartSr.length
  const reqIdsWithResponse = new Set(chartSr.map((response) => response.req_id))
  const requestsWithResponse = chartFr.filter((request) => reqIdsWithResponse.has(request.id)).length
  const responsePercent =
    requestCount > 0 ? Math.round((requestsWithResponse / requestCount) * 100) : 0

  return {
    articles: articleIds.size,
    loiCount: loiIssueIds.size,
    loiIndicatorCount,
    concludingCount: concludingIssueIds.size,
    concludingIndicatorCount,
    categoriesCount: categoryIds.size,
    requestCount,
    responseCount,
    requestsWithResponse,
    responsePercent,
  }
}

function resolveYearLabel(f: ReportFilters, indicators: ReportLookupIndicator[]): string {
  if (!f.collectionYearId) return 'All years'
  for (const ind of indicators) {
    const match = ind.collection_years?.find((y) => String(y.id) === f.collectionYearId)
    if (match) return match.label
  }
  return 'All years'
}

function buildFilterSummaryParts(
  f: ReportFilters,
  lookups: {
    conventions: ReportLookupConvention[]
    categories: ReportLookupCategory[]
    articles: ReportLookupArticle[]
    indicators: ReportLookupIndicator[]
    regions: RegionRow[]
  },
  yearLabel: string,
): ReportFilterSummaryPart[] {
  const convention = lookups.conventions.find((c) => String(c.id) === f.convention)
  const category = lookups.categories.find((c) => String(c.id) === f.categoryId)
  const article = lookups.articles.find((a) => String(a.id) === f.articleId)
  const indicator = lookups.indicators.find((i) => String(i.id) === f.indicatorId)
  const region = f.regionId ? lookups.regions.find((r) => String(r.id) === f.regionId) : null

  const parts: ReportFilterSummaryPart[] = []
  if (region) parts.push({ label: 'Region', value: region.name })
  if (convention) {
    parts.push({ label: 'Convention', value: convention.code || convention.name })
  }
  if (article) parts.push({ label: 'Article', value: article.article_name })
  if (f.entryKind) {
    parts.push({
      label: `${LOI_LABEL} / ${CONCLUDING_OBSERVATIONS_LABEL}`,
      value: issueEntryKindBadgeLabel(f.entryKind),
    })
  }
  if (category) parts.push({ label: 'Category', value: category.name })
  if (indicator) {
    parts.push({
      label: 'Indicator',
      value:
        indicator.indicator_text.length > 80
          ? `${indicator.indicator_text.slice(0, 80)}…`
          : indicator.indicator_text,
    })
  }
  if (f.collectionYearId) parts.push({ label: 'Year', value: yearLabel })
  return parts
}

export function buildReportingDashboard(
  requests: HrRequestRow[],
  responses: RegionalResponseRow[],
  compiled: CompiledRecordRow[],
  f: ReportFilters,
  lookups: {
    conventions: ReportLookupConvention[]
    categories: ReportLookupCategory[]
    regions: RegionRow[]
    articles: ReportLookupArticle[]
    indicators: ReportLookupIndicator[]
    issueArticleLinks: Array<{ issue_id: number; article_id: number }>
  },
): ReportingDashboardResult {
  const regionsById = new Map(lookups.regions.map((r) => [r.id, r]))
  const issueArticleMap = buildIssueArticleMap(lookups.issueArticleLinks)
  const indicatorIssueMap = buildIndicatorIssueMap(lookups.indicators)
  const issueYearMap = buildIssueYearMap(lookups.indicators)
  const yearLabel = resolveYearLabel(f, lookups.indicators)
  const filterSummaryParts = buildFilterSummaryParts(f, lookups, yearLabel)
  const filterSummary = filterSummaryParts.map((part) => `${part.label}: ${part.value}`).join(' · ')
  const focusedIndicator = lookups.indicators.find((i) => String(i.id) === f.indicatorId)

  if (f.indicatorId) {
    const cr = filterCompiled(
      compiled,
      requests,
      f,
      regionsById,
      issueArticleMap,
      indicatorIssueMap,
      issueYearMap,
    )
    return {
      filterSummary,
      filterSummaryParts,
      indicatorFocusMode: true,
      focusedIndicatorId: f.indicatorId,
      focusedIndicatorLabel: focusedIndicator?.indicator_text,
      focusedYearId: f.collectionYearId ? Number(f.collectionYearId) : undefined,
      focusedYearLabel: f.collectionYearId ? yearLabel : undefined,
      indicatorFocusCompiled: cr,
      summaryCards: {
        articles: 0,
        loiCount: 0,
        loiIndicatorCount: 0,
        concludingCount: 0,
        concludingIndicatorCount: 0,
        categoriesCount: 0,
        requestCount: 0,
        responseCount: 0,
        requestsWithResponse: 0,
        responsePercent: 0,
      },
      recordStatusBar: [],
      entryKindPie: [],
      regionBar: [],
      topCategories: [],
      topIndicators: [],
      indicatorCompiledRows: cr.map((c) => ({
        id: c.id,
        title: c.title,
        status: formatStatusLabel(c.status),
        compilationDate: c.compilation_date ?? '—',
        submissionDate: c.submission_date ?? '—',
        regions: c.region_names.join('; ') || '—',
        summary: c.summary?.trim() || '—',
      })),
    }
  }

  const chartFilters = filtersForDashboardCharts(f)
  const chartFr = filterRequests(requests, chartFilters, issueArticleMap, indicatorIssueMap, issueYearMap)
  const chartSr = filterResponses(
    responses,
    requests,
    chartFilters,
    issueArticleMap,
    indicatorIssueMap,
    issueYearMap,
  )
  const chartCr = filterCompiled(
    compiled,
    requests,
    chartFilters,
    regionsById,
    issueArticleMap,
    indicatorIssueMap,
    issueYearMap,
  )
  const reqById = new Map(requests.map((r) => [r.id, r]))

  const recordStatusBar: ReportChartPoint[] = [
    { name: 'Request data', value: chartFr.length },
    { name: 'Response data', value: chartSr.length },
    { name: 'Compiled data', value: chartCr.length },
  ]

  const entryKindMap = countMap(
    chartFr.map((r) => issueEntryKindBadgeLabel(coerceIssueEntryKind(r.issue?.entry_kind))),
  )
  const entryKindPie = mapToChartPoints(entryKindMap, 10)

  const regionMap = countMap(
    chartCr.flatMap((c) => (c.region_names.length ? c.region_names : ['—'])),
  )
  const regionBar = mapToChartPoints(regionMap, 12)

  const categoryCounts: Record<string, { id: string; label: string; count: number }> = {}
  for (const c of chartCr) {
    const req = c.req_id ? reqById.get(c.req_id) : undefined
    const name = req?.issue?.category?.name?.trim()
    if (!name) continue
    const id = String(req?.issue?.category?.id ?? name)
    if (!categoryCounts[id]) {
      categoryCounts[id] = { id, label: name, count: 0 }
    }
    categoryCounts[id].count += 1
  }
  const topCategories = buildRankRows(
    Object.values(categoryCounts).map((row) => ({
      id: row.id,
      shortLabel: row.label,
      label: row.label,
      count: row.count,
    })),
  )

  const indicatorCounts: Record<number, { id: string; label: string; count: number }> = {}
  for (const c of chartCr) {
    const req = c.req_id ? reqById.get(c.req_id) : undefined
    if (!req?.issue_id) continue
    const issueId = Number(req.issue_id)
    for (const ind of lookups.indicators) {
      if (ind.issue_id !== issueId) continue
      if (!indicatorCounts[ind.id]) {
        indicatorCounts[ind.id] = {
          id: String(ind.id),
          label: ind.indicator_text,
          count: 0,
        }
      }
      indicatorCounts[ind.id].count += 1
    }
  }
  const topIndicators = buildRankRows(
    Object.values(indicatorCounts).map((row, index) => ({
      id: row.id,
      shortLabel: `Ind ${index + 1}`,
      label: row.label,
      count: row.count,
    })),
  )

  return {
    filterSummary,
    filterSummaryParts,
    indicatorFocusMode: false,
    focusedIndicatorId: undefined,
    indicatorFocusCompiled: [],
    summaryCards: buildSummaryCards(
      chartFr,
      chartSr,
      chartCr,
      reqById,
      issueArticleMap,
      lookups.indicators,
    ),
    recordStatusBar,
    entryKindPie,
    regionBar,
    topCategories,
    topIndicators,
    indicatorCompiledRows: [],
  }
}

export function buildReportData(
  requests: HrRequestRow[],
  responses: RegionalResponseRow[],
  compiled: CompiledRecordRow[],
  f: ReportFilters,
  lookups: {
    conventions: ReportLookupConvention[]
    categories: ReportLookupCategory[]
    regions: RegionRow[]
    articles: ReportLookupArticle[]
    indicators: ReportLookupIndicator[]
    issueArticleLinks: Array<{ issue_id: number; article_id: number }>
  },
): ReportBuildResult {
  const regionsById = new Map(lookups.regions.map((r) => [r.id, r]))
  const issueArticleMap = buildIssueArticleMap(lookups.issueArticleLinks)
  const indicatorIssueMap = buildIndicatorIssueMap(lookups.indicators)
  const issueYearMap = buildIssueYearMap(lookups.indicators)
  const yearLabel = resolveYearLabel(f, lookups.indicators)
  const convention = lookups.conventions.find((c) => String(c.id) === f.convention)
  const category = lookups.categories.find((c) => String(c.id) === f.categoryId)
  const article = lookups.articles.find((a) => String(a.id) === f.articleId)
  const indicator = lookups.indicators.find((i) => String(i.id) === f.indicatorId)
  const region = f.regionId ? regionsById.get(Number(f.regionId)) : null

  const filterSummary = [
    'Compiled data report',
    region ? `Region: ${region.name}` : null,
    convention ? `Convention: ${convention.code} — ${convention.name}` : null,
    article ? `Article: ${article.article_name}` : null,
    f.entryKind
      ? `${LOI_LABEL} / ${CONCLUDING_OBSERVATIONS_LABEL}: ${issueEntryKindBadgeLabel(f.entryKind)}`
      : null,
    category ? `Category: ${category.name}` : null,
    indicator
      ? `Indicator: ${
          indicator.indicator_text.length > 48
            ? `${indicator.indicator_text.slice(0, 48)}…`
            : indicator.indicator_text
        }`
      : null,
    `Year: ${yearLabel}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const fr = filterRequests(requests, f, issueArticleMap, indicatorIssueMap, issueYearMap)
  const sr = filterResponses(responses, requests, f, issueArticleMap, indicatorIssueMap, issueYearMap)
  const cr = filterCompiled(
    compiled,
    requests,
    f,
    regionsById,
    issueArticleMap,
    indicatorIssueMap,
    issueYearMap,
  )
  const reqById = new Map(requests.map((r) => [r.id, r]))

  if (f.dataSource === 'requests') {
    const statusMap = countMap(fr.map((r) => formatStatusLabel(r.status)))
    const regionMap = countMap(
      fr.flatMap((r) =>
        r.regions?.length ? r.regions.map((x) => x.name) : [regionNamesOfRequest(r) || '—'],
      ),
    )
    const typeMap = countMap(
      fr.map((r) => issueEntryKindBadgeLabel(coerceIssueEntryKind(r.issue?.entry_kind))),
    )
    const catMap = countMap(fr.map((r) => r.issue?.category?.name ?? '—'))
    const timeline = buildTimeline(fr.map((r) => r.date))
    const withResponse = fr.filter((r) => responses.some((x) => x.req_id === r.id)).length

    return {
      title: `Request data report (${fr.length} records)`,
      filterSummary,
      metrics: [
        { label: 'Total Requests', value: fr.length },
        { label: 'Active', value: fr.filter((r) => r.status === 'active').length },
        { label: 'Draft', value: fr.filter((r) => r.status === 'draft').length },
        {
          label: 'With Regional Response',
          value: fr.length ? `${Math.round((withResponse / fr.length) * 100)}%` : '0%',
        },
      ],
      charts: [
        { id: 'status', title: 'Request status', type: 'pie', points: mapToChartPoints(statusMap) },
        { id: 'region', title: 'Requests by region', type: 'bar', points: mapToChartPoints(regionMap) },
        { id: 'trend', title: 'Monthly trend', type: 'line', points: [], timeline },
        { id: 'category', title: 'By category', type: 'pie', points: mapToChartPoints(catMap) },
        { id: 'type', title: `${LOI_LABEL} vs ${CONCLUDING_OBSERVATIONS_LABEL}`, type: 'bar', points: mapToChartPoints(typeMap) },
        { id: 'volume', title: 'Volume over time', type: 'area', points: [], timeline },
      ],
      tableHeaders: [
        'Request ID',
        'Title',
        'Status',
        'Due date',
        'Convention code',
        'Convention name',
        'Type',
        'Category',
        LABEL_LOI_OBSERVATION_TITLE,
        'Description',
        'Regions',
        'Departments',
        'Details',
      ],
      tableRows: fr.map((r) => ({
        'Request ID': r.id,
        Title: r.title,
        Status: formatStatusLabel(r.status),
        'Due date': r.date,
        'Convention code': r.convention?.code ?? r.conv ?? '—',
        'Convention name': r.convention?.name ?? '—',
        Type: issueEntryKindBadgeLabel(coerceIssueEntryKind(r.issue?.entry_kind)),
        Category: r.issue?.category?.name ?? '—',
        LABEL_LOI_OBSERVATION_TITLE: r.issue ? issueEntryPrimaryText(r.issue) || '—' : '—',
        Description: r.issue?.description?.trim() || r.details?.trim() || '—',
        Regions: regionNamesOfRequest(r) || '—',
        Departments: departmentNamesOfRequest(r) || '—',
        Details: r.details?.trim() || '—',
      })),
    }
  }

  if (f.dataSource === 'responses') {
    const reviewMap = countMap(sr.map((r) => formatStatusLabel(r.review_status || 'unknown')))
    const regionMap = countMap(sr.map((r) => r.region_name ?? '—'))
    const timeline = buildTimeline(sr.map((r) => r.submission_date))
    const typeMap = countMap(
      sr.map((r) => {
        const req = reqById.get(r.req_id)
        return issueEntryKindBadgeLabel(coerceIssueEntryKind(req?.issue?.entry_kind))
      }),
    )

    return {
      title: `Response data report (${sr.length} records)`,
      filterSummary,
      metrics: [
        { label: 'Total Responses', value: sr.length },
        { label: 'Regions', value: Object.keys(regionMap).filter((k) => k !== '—').length },
        { label: 'Accepted', value: sr.filter((r) => r.review_status === 'accepted').length },
      ],
      charts: [
        { id: 'review', title: 'Review status', type: 'pie', points: mapToChartPoints(reviewMap) },
        { id: 'region', title: 'Responses by region', type: 'bar', points: mapToChartPoints(regionMap) },
        { id: 'trend', title: 'Submissions over time', type: 'line', points: [], timeline },
        { id: 'type', title: 'Linked entry type', type: 'bar', points: mapToChartPoints(typeMap) },
        { id: 'review-bar', title: 'Review status counts', type: 'bar', points: mapToChartPoints(reviewMap) },
        { id: 'volume', title: 'Submission volume', type: 'area', points: [], timeline },
      ],
      tableHeaders: [
        'Response ID',
        'Request ID',
        'Region',
        'Title',
        'Submission date',
        'Review status',
        'Comments',
        'Convention code',
        'Convention name',
        'Type',
        'Category',
        LABEL_LOI_OBSERVATION_TITLE,
        'Request status',
        'Request due date',
      ],
      tableRows: sr.map((r) => {
        const req = reqById.get(r.req_id)
        return {
          'Response ID': r.id,
          'Request ID': r.req_id,
          Region: r.region_name ?? '—',
          Title: r.title,
          'Submission date': r.submission_date,
          'Review status': formatStatusLabel(r.review_status),
          Comments: r.comments?.trim() || '—',
          ...linkedRequestFields(req),
        }
      }),
    }
  }

  const statusMap = countMap(cr.map((c) => formatStatusLabel(c.status || 'unknown')))
  const regionMap = countMap(cr.flatMap((c) => (c.region_names.length ? c.region_names : ['—'])))
  const timeline = buildTimeline(cr.map((c) => c.compilation_date ?? c.submission_date ?? ''))
  const typeMap = countMap(
    cr.map((c) => {
      const req = c.req_id ? reqById.get(c.req_id) : undefined
      return issueEntryKindBadgeLabel(coerceIssueEntryKind(req?.issue?.entry_kind))
    }),
  )

  return {
    title: `Compiled data report (${cr.length} records)`,
    filterSummary,
    metrics: [
      { label: LABEL_TOTAL_RECORDS, value: cr.length },
      { label: 'Submitted', value: cr.filter((c) => c.status === 'submitted').length },
      { label: 'Draft', value: cr.filter((c) => c.status === 'draft').length },
    ],
    charts: [
      { id: 'status', title: 'Compilation status', type: 'pie', points: mapToChartPoints(statusMap) },
      { id: 'region', title: 'Records by region', type: 'bar', points: mapToChartPoints(regionMap) },
      { id: 'trend', title: 'Compilations over time', type: 'line', points: [], timeline },
      { id: 'type', title: 'Linked entry type', type: 'bar', points: mapToChartPoints(typeMap) },
      { id: 'region-share', title: 'Regional share', type: 'pie', points: mapToChartPoints(regionMap, 8) },
      { id: 'volume', title: 'Compilation volume', type: 'area', points: [], timeline },
    ],
    tableHeaders: [
      'Compiled ID',
      'HR request ID',
      'Title',
      'Status',
      'Compilation date',
      'Submission date',
      'Submitted to',
      'Regions',
      'Summary',
      'Convention code',
      'Convention name',
      'Type',
      'Category',
      LABEL_LOI_OBSERVATION_TITLE,
    ],
    tableRows: cr.map((c) => {
      const req = c.req_id ? reqById.get(c.req_id) : undefined
      return {
        'Compiled ID': c.id,
        'HR request ID': c.req_id ?? '—',
        Title: c.title,
        Status: formatStatusLabel(c.status),
        'Compilation date': c.compilation_date ?? '—',
        'Submission date': c.submission_date ?? '—',
        'Submitted to': c.submitted_to ?? '—',
        Regions: c.region_names.join('; ') || '—',
        Summary: c.summary?.trim() || '—',
        'Convention code': req?.convention?.code ?? req?.conv ?? '—',
        'Convention name': req?.convention?.name ?? '—',
        Type: issueEntryKindBadgeLabel(coerceIssueEntryKind(req?.issue?.entry_kind)),
        Category: req?.issue?.category?.name ?? '—',
        LABEL_LOI_OBSERVATION_TITLE: req?.issue ? issueEntryPrimaryText(req.issue) || '—' : '—',
      }
    }),
  }
}
