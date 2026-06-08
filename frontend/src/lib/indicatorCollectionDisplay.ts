import type { HrRequestIssueIndicator } from '../types/hrRequest'

export type IndicatorYearGenderLine = {
  year_id: number
  label: string
  genders: string[]
}

export function indicatorYearGenderLines(
  ind: Pick<HrRequestIssueIndicator, 'collects_by_year' | 'collects_by_gender' | 'collection_by_year'>,
): IndicatorYearGenderLine[] {
  if (!ind.collects_by_year || !ind.collection_by_year?.length) {
    return []
  }
  const byGender = ind.collects_by_gender !== false
  return ind.collection_by_year.map((y) => ({
    year_id: y.year_id,
    label: y.label,
    genders: byGender ? (y.genders ?? []).map((g) => g.name).filter(Boolean) : [],
  }))
}

export function formatIndicatorYearGenderSummary(
  ind: Pick<HrRequestIssueIndicator, 'collects_by_year' | 'collects_by_gender' | 'collection_by_year'>,
): string | null {
  const lines = indicatorYearGenderLines(ind)
  if (lines.length === 0) return null
  const byGender = ind.collects_by_gender !== false
  if (!byGender) {
    return lines.map((line) => line.label).join('; ')
  }
  return lines
    .map((line) => `${line.label}: ${line.genders.length > 0 ? line.genders.join(', ') : '—'}`)
    .join('; ')
}
