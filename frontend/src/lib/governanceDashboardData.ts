import type { DepartmentTaskRow } from '../api/lists'
import type { ReportLookupIndicator } from '../api/reports'
import { parseDepartmentTaskResponseData } from './departmentTaskResponseFormat'
import { GENDER_TOTAL_COLUMN_ID } from './indicatorMatrixColumns'

export type GovernanceFilters = {
  convention: string
  entryKind: '' | 'issue' | 'recommendation'
  categoryId: string
  indicatorIds: string[]
}

export type IndicatorTrendPoint = {
  yearId: string
  year: string
  total: number
}

export type IndicatorTrendSeries = {
  indicatorId: string
  indicatorLabel: string
  points: IndicatorTrendPoint[]
}

/** Prefer stored Total; otherwise sum individual gender cells (legacy rows). */
export function genderTotalFromYearCells(
  genders: Record<string, { value?: number | null } | null | undefined> | null | undefined,
): number | null {
  if (!genders || typeof genders !== 'object') return null

  const totalCell = genders[GENDER_TOTAL_COLUMN_ID]
  const totalRaw = totalCell?.value
  if (totalRaw != null && Number.isFinite(Number(totalRaw))) {
    return Number(totalRaw)
  }

  let sum = 0
  let any = false
  for (const [key, cell] of Object.entries(genders)) {
    if (key === GENDER_TOTAL_COLUMN_ID) continue
    const raw = cell?.value
    if (raw == null || !Number.isFinite(Number(raw))) continue
    sum += Number(raw)
    any = true
  }
  return any ? sum : null
}

function yearLabelMap(indicators: ReportLookupIndicator[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const ind of indicators) {
    for (const y of ind.collection_years ?? []) {
      const id = String(y.id)
      if (!map.has(id)) map.set(id, y.label)
    }
  }
  return map
}

function sortYearIds(yearIds: string[], labels: Map<string, string>): string[] {
  return [...yearIds].sort((a, b) => {
    const la = labels.get(a) ?? a
    const lb = labels.get(b) ?? b
    const na = Number(la)
    const nb = Number(lb)
    if (Number.isFinite(na) && Number.isFinite(nb) && String(na) === la && String(nb) === lb) {
      return na - nb
    }
    return la.localeCompare(lb, undefined, { numeric: true, sensitivity: 'base' })
  })
}

/**
 * Aggregate gender totals by year across department task responses for the selected indicators.
 * Totals from multiple departments/tasks are summed per year.
 */
export function buildIndicatorGenderTrendSeries(
  tasks: DepartmentTaskRow[],
  indicators: ReportLookupIndicator[],
  selectedIndicatorIds: string[],
): IndicatorTrendSeries[] {
  const selected = new Set(selectedIndicatorIds.map(String))
  const byId = new Map(indicators.map((i) => [String(i.id), i]))
  const labels = yearLabelMap(indicators)

  const totals = new Map<string, Map<string, number>>()

  for (const task of tasks) {
    const parsed = parseDepartmentTaskResponseData(task.response_data, task.attachment_url)
    if (parsed.kind !== 'structured') continue

    for (const [indicatorId, bundle] of Object.entries(parsed.payload.by_indicator)) {
      if (!selected.has(indicatorId)) continue
      const byYear = bundle.quantitative?.by_year_gender
      if (!byYear) continue

      let yearMap = totals.get(indicatorId)
      if (!yearMap) {
        yearMap = new Map()
        totals.set(indicatorId, yearMap)
      }

      for (const [yearId, genders] of Object.entries(byYear)) {
        const n = genderTotalFromYearCells(genders)
        if (n == null) continue
        yearMap.set(yearId, (yearMap.get(yearId) ?? 0) + n)
      }
    }
  }

  const series: IndicatorTrendSeries[] = []
  for (const indicatorId of selectedIndicatorIds) {
    const ind = byId.get(indicatorId)
    const yearMap = totals.get(indicatorId) ?? new Map<string, number>()
    const configuredYears = (ind?.collection_years ?? []).map((y) => String(y.id))
    const dataYears = [...yearMap.keys()]
    const yearIds = sortYearIds(
      [...new Set([...configuredYears, ...dataYears])],
      labels,
    )

    series.push({
      indicatorId,
      indicatorLabel: ind?.indicator_text?.trim() || `Indicator #${indicatorId}`,
      points: yearIds.map((yearId) => ({
        yearId,
        year: labels.get(yearId) ?? yearId,
        total: yearMap.get(yearId) ?? 0,
      })),
    })
  }

  return series
}
