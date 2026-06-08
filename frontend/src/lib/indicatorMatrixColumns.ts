import type { HrRequestIssueIndicator } from '../types/hrRequest'

/** Synthetic gender id for year-only matrix cells (no gender breakdown). */
export const YEAR_ONLY_GENDER_ID = 0

export const YEAR_ONLY_GENDER_LABEL = 'Value'

export type MatrixGenderColumn = {
  gender_id: number
  gender_name: string
}

export type MatrixYearColumnGroup = {
  year_id: number
  year_label: string
  genders: MatrixGenderColumn[]
}

export function matrixCellKey(yearId: number, genderId: number): string {
  return `${yearId}-${genderId}`
}

function indicatorCollectsByGender(ind: HrRequestIssueIndicator): boolean {
  return ind.collects_by_gender !== false
}

/** Column groups for indicators that collect by year (union of all configured year→gender pairs). */
export function buildMatrixColumnGroups(indicators: HrRequestIssueIndicator[]): MatrixYearColumnGroup[] {
  const yearMap = new Map<number, { label: string; genders: Map<number, string> }>()

  for (const ind of indicators) {
    if (!ind.collects_by_year) continue
    for (const y of ind.collection_by_year ?? []) {
      const existing = yearMap.get(y.year_id) ?? { label: y.label, genders: new Map<number, string>() }
      existing.label = y.label || existing.label
      if (indicatorCollectsByGender(ind)) {
        for (const g of y.genders ?? []) {
          existing.genders.set(g.id, g.name)
        }
      } else {
        existing.genders.set(YEAR_ONLY_GENDER_ID, YEAR_ONLY_GENDER_LABEL)
      }
      yearMap.set(y.year_id, existing)
    }
  }

  return [...yearMap.entries()]
    .sort(([, a], [, b]) => a.label.localeCompare(b.label, undefined, { numeric: true }))
    .map(([year_id, row]) => ({
      year_id,
      year_label: row.label,
      genders: [...row.genders.entries()]
        .sort(([aId], [bId]) => {
          if (aId === YEAR_ONLY_GENDER_ID) return -1
          if (bId === YEAR_ONLY_GENDER_ID) return 1
          const aName = row.genders.get(aId) ?? ''
          const bName = row.genders.get(bId) ?? ''
          return aName.localeCompare(bName, undefined, { sensitivity: 'base' })
        })
        .map(([gender_id, gender_name]) => ({ gender_id, gender_name })),
    }))
}

/** Year × gender numeric table applies whenever those dimensions are configured (Q/L flags are separate). */
export function indicatorUsesDataMatrix(ind: HrRequestIssueIndicator): boolean {
  return Boolean(ind.collects_by_year && (ind.collection_by_year?.length ?? 0) > 0)
}

/** Show unified data table when any scoped indicator has year/gender columns configured. */
export function deptFormUsesIndicatorMatrix(indicators: HrRequestIssueIndicator[]): boolean {
  return indicators.length > 0 && buildMatrixColumnGroups(indicators).length > 0
}

export function indicatorMatrixCellAllowed(
  ind: HrRequestIssueIndicator,
  yearId: number,
  genderId: number,
): boolean {
  const yearRow = (ind.collection_by_year ?? []).find((y) => y.year_id === yearId)
  if (!yearRow) return false
  if (!indicatorCollectsByGender(ind)) {
    return genderId === YEAR_ONLY_GENDER_ID
  }
  return (yearRow.genders ?? []).some((g) => g.id === genderId)
}

/** Iterate configured matrix cells for validation and submit payloads. */
export function forEachIndicatorMatrixCell(
  ind: HrRequestIssueIndicator,
  fn: (yearId: number, genderId: number) => void,
): void {
  for (const y of ind.collection_by_year ?? []) {
    if (!indicatorCollectsByGender(ind)) {
      fn(y.year_id, YEAR_ONLY_GENDER_ID)
      continue
    }
    for (const g of y.genders ?? []) {
      fn(y.year_id, g.id)
    }
  }
}
