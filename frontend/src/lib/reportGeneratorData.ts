import type { CompiledRecordRow, RegionalResponseRow } from '../api/lists'
import type { ReportLookupCategory, ReportLookupConvention } from '../api/reports'
import type { RegionRow } from '../api/regions'
import {
  CONCLUDING_OBSERVATIONS_LABEL,
  LOI_LABEL,
  coerceIssueEntryKind,
  issueEntryKindBadgeLabel,
} from './issueEntryKind'
import { resolveReportDateRange, type DateRangePreset } from './reportDateRange'
import type { HrRequestRow } from '../types/hrRequest'

export type ReportDataSource = 'requests' | 'responses' | 'consolidated'

export type ReportEntryKindFilter = '' | 'issue' | 'recommendation'

export type ReportFilters = {
  dataSource: ReportDataSource
  regionId: string
  convention: string
  entryKind: ReportEntryKindFilter
  categoryId: string
  datePreset: DateRangePreset
  dateFrom: string
  dateTo: string
  monthYearMonth: string
  monthYearYear: string
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

function matchesDateRange(date: string, dateFrom: string, dateTo: string): boolean {
  if (!date) return !dateFrom && !dateTo
  if (dateFrom && date < dateFrom) return false
  if (dateTo && date > dateTo) return false
  return true
}

function filterRequests(
  requests: HrRequestRow[],
  f: ReportFilters,
  dateFrom: string,
  dateTo: string,
): HrRequestRow[] {
  return requests.filter((r) => {
    if (!requestMatchesRegion(r, f.regionId)) return false
    if (!matchesConvention(r, f.convention)) return false
    if (!matchesEntryKind(r, f.entryKind)) return false
    if (!matchesCategory(r, f.categoryId)) return false
    if (!matchesDateRange(r.date, dateFrom, dateTo)) return false
    return true
  })
}

function filterResponses(
  responses: RegionalResponseRow[],
  requests: HrRequestRow[],
  f: ReportFilters,
  dateFrom: string,
  dateTo: string,
): RegionalResponseRow[] {
  const reqById = new Map(requests.map((r) => [r.id, r]))
  return responses.filter((resp) => {
    if (f.regionId && String(resp.region_id ?? '') !== f.regionId) return false
    if (!matchesDateRange(resp.submission_date, dateFrom, dateTo)) return false
    const req = reqById.get(resp.req_id)
    if (!req) return false
    if (!matchesConvention(req, f.convention)) return false
    if (!matchesEntryKind(req, f.entryKind)) return false
    if (!matchesCategory(req, f.categoryId)) return false
    return true
  })
}

function filterCompiled(
  compiled: CompiledRecordRow[],
  requests: HrRequestRow[],
  f: ReportFilters,
  dateFrom: string,
  dateTo: string,
  regionsById: Map<number, RegionRow>,
): CompiledRecordRow[] {
  const reqById = new Map(requests.map((r) => [r.id, r]))
  const regionName = f.regionId ? regionsById.get(Number(f.regionId))?.name : null
  return compiled.filter((c) => {
    if (regionName && !c.region_names.some((n) => n === regionName)) return false
    const d = c.compilation_date ?? c.submission_date ?? ''
    if (!matchesDateRange(d, dateFrom, dateTo)) return false
    const req = c.req_id ? reqById.get(c.req_id) : undefined
    if (f.convention || f.entryKind || f.categoryId) {
      if (!req) return false
      if (!matchesConvention(req, f.convention)) return false
      if (!matchesEntryKind(req, f.entryKind)) return false
      if (!matchesCategory(req, f.categoryId)) return false
    }
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
      'LOI / observation title': '—',
      'Request status': '—',
      'Request due date': '—',
    }
  }
  return {
    'Convention code': req.convention?.code ?? req.conv ?? '—',
    'Convention name': req.convention?.name ?? '—',
    Type: issueEntryKindBadgeLabel(coerceIssueEntryKind(req.issue?.entry_kind)),
    Category: req.issue?.category?.name ?? '—',
    'LOI / observation title': req.issue?.issue_title ?? '—',
    'Request status': formatStatusLabel(req.status),
    'Request due date': req.date || '—',
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
  },
): ReportBuildResult {
  const regionsById = new Map(lookups.regions.map((r) => [r.id, r]))
  const { dateFrom, dateTo, label: dateLabel } = resolveReportDateRange({
    preset: f.datePreset,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
    monthYearMonth: f.monthYearMonth,
    monthYearYear: f.monthYearYear,
  })
  const convention = lookups.conventions.find((c) => String(c.id) === f.convention)
  const category = lookups.categories.find((c) => String(c.id) === f.categoryId)
  const region = f.regionId ? regionsById.get(Number(f.regionId)) : null

  const filterSummary = [
    f.dataSource === 'requests'
      ? 'Request data report'
      : f.dataSource === 'responses'
        ? 'Response data report'
        : 'Compiled data report',
    region ? `Region: ${region.name}` : null,
    convention ? `Convention: ${convention.code} — ${convention.name}` : null,
    f.entryKind
      ? `${LOI_LABEL} / ${CONCLUDING_OBSERVATIONS_LABEL}: ${issueEntryKindBadgeLabel(f.entryKind)}`
      : null,
    category ? `Category: ${category.name}` : null,
    `Period: ${dateLabel}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const fr = filterRequests(requests, f, dateFrom, dateTo)
  const sr = filterResponses(responses, requests, f, dateFrom, dateTo)
  const cr = filterCompiled(compiled, requests, f, dateFrom, dateTo, regionsById)
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
        { label: 'Total requests', value: fr.length },
        { label: 'Active', value: fr.filter((r) => r.status === 'active').length },
        { label: 'Draft', value: fr.filter((r) => r.status === 'draft').length },
        {
          label: 'With regional response',
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
        'LOI / observation title',
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
        'LOI / observation title': r.issue?.issue_title ?? '—',
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
        { label: 'Total responses', value: sr.length },
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
        'LOI / observation title',
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
      { label: 'Total records', value: cr.length },
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
      'LOI / observation title',
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
        'LOI / observation title': req?.issue?.issue_title ?? '—',
      }
    }),
  }
}
