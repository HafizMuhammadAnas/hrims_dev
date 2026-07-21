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

/** Alias — same Total-cell rules apply to every year-keyed dimension matrix. */
export const dimensionTotalFromYearCells = genderTotalFromYearCells

export const GOVERNANCE_DIMENSION_SERIES = [
  { key: 'gender', label: 'Gender', field: 'by_year_gender' as const },
  { key: 'age', label: 'Age', field: 'by_year_age' as const },
  { key: 'disability', label: 'Disability', field: 'by_year_disability' as const },
  { key: 'district', label: 'District', field: 'by_year_district' as const },
  { key: 'religion', label: 'Religion', field: 'by_year_religion' as const },
  {
    key: 'consolidated',
    label: 'Consolidated Data',
    field: 'by_year_consolidated' as const,
  },
] as const

export type GovernanceDimensionKey = (typeof GOVERNANCE_DIMENSION_SERIES)[number]['key']

export type DimensionTotalsPoint = {
  yearId: string
  year: string
} & Partial<Record<GovernanceDimensionKey, number>>

export type IndicatorDimensionTotalsSeries = {
  indicatorId: string
  indicatorLabel: string
  /** Dimension keys that have at least one non-null year total in the data. */
  dimensions: Array<{ key: GovernanceDimensionKey; label: string }>
  points: DimensionTotalsPoint[]
}

/**
 * Aggregate each dimension’s year Total across department tasks for one or more indicators.
 * Dimensions stay parallel (gender Total vs age Total are not summed together).
 */
export function buildIndicatorDimensionTotalsSeries(
  tasks: DepartmentTaskRow[],
  indicators: ReportLookupIndicator[],
  selectedIndicatorIds: string[],
): IndicatorDimensionTotalsSeries[] {
  const selected = new Set(selectedIndicatorIds.map(String))
  const byId = new Map(indicators.map((i) => [String(i.id), i]))
  const labels = yearLabelMap(indicators)

  // indicatorId -> yearId -> dimensionKey -> sum
  const totals = new Map<string, Map<string, Map<GovernanceDimensionKey, number>>>()

  for (const task of tasks) {
    const parsed = parseDepartmentTaskResponseData(task.response_data, task.attachment_url)
    if (parsed.kind !== 'structured') continue

    for (const [indicatorId, bundle] of Object.entries(parsed.payload.by_indicator)) {
      if (!selected.has(String(indicatorId))) continue
      const quantitative = bundle.quantitative
      if (!quantitative) continue

      let yearMap = totals.get(String(indicatorId))
      if (!yearMap) {
        yearMap = new Map()
        totals.set(String(indicatorId), yearMap)
      }

      for (const dim of GOVERNANCE_DIMENSION_SERIES) {
        const keyed =
          dim.key === 'consolidated'
            ? quantitative.by_year_consolidated ?? quantitative.by_year_others
            : quantitative[dim.field]
        if (!keyed) continue
        for (const [yearId, cells] of Object.entries(keyed)) {
          const n = dimensionTotalFromYearCells(cells)
          if (n == null) continue
          const yid = String(yearId)
          let dimMap = yearMap.get(yid)
          if (!dimMap) {
            dimMap = new Map()
            yearMap.set(yid, dimMap)
          }
          dimMap.set(dim.key, (dimMap.get(dim.key) ?? 0) + n)
        }
      }
    }
  }

  const series: IndicatorDimensionTotalsSeries[] = []
  for (const indicatorId of selectedIndicatorIds.map(String)) {
    const ind = byId.get(indicatorId)
    const yearMap = totals.get(indicatorId) ?? new Map<string, Map<GovernanceDimensionKey, number>>()
    const configuredYears = (ind?.collection_years ?? []).map((y) => String(y.id))
    const dataYears = [...yearMap.keys()]
    const yearIds = sortYearIds([...new Set([...configuredYears, ...dataYears])], labels)

    const presentKeys = new Set<GovernanceDimensionKey>()
    for (const dimMap of yearMap.values()) {
      for (const [key, value] of dimMap.entries()) {
        if (value != null && Number.isFinite(value)) presentKeys.add(key)
      }
    }

    const dimensions = GOVERNANCE_DIMENSION_SERIES.filter((d) => presentKeys.has(d.key)).map(
      (d) => ({ key: d.key, label: d.label }),
    )

    series.push({
      indicatorId,
      indicatorLabel: ind?.indicator_text?.trim() || `Indicator #${indicatorId}`,
      dimensions,
      points: yearIds.map((yearId) => {
        const dimMap = yearMap.get(yearId)
        const point: DimensionTotalsPoint = {
          yearId,
          year: labels.get(yearId) ?? yearId,
        }
        for (const dim of dimensions) {
          point[dim.key] = dimMap?.get(dim.key) ?? 0
        }
        return point
      }),
    })
  }

  return series
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
 * Aggregate year totals across department task responses for the selected indicators.
 * Uses Consolidated Data / Year totals only (the Year totals bar on department entry).
 * Does not use Gender (or other dimension) Totals for these graphs.
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
      if (!selected.has(String(indicatorId))) continue
      const quantitative = bundle.quantitative
      if (!quantitative) continue

      let yearMap = totals.get(String(indicatorId))
      if (!yearMap) {
        yearMap = new Map()
        totals.set(String(indicatorId), yearMap)
      }

      const byYearConsolidated =
        quantitative.by_year_consolidated ?? quantitative.by_year_others
      if (!byYearConsolidated) continue

      for (const [yearId, cells] of Object.entries(byYearConsolidated)) {
        const n = dimensionTotalFromYearCells(cells)
        if (n == null) continue
        yearMap.set(String(yearId), (yearMap.get(String(yearId)) ?? 0) + n)
      }
    }
  }

  const series: IndicatorTrendSeries[] = []
  for (const indicatorId of selectedIndicatorIds.map(String)) {
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
