import type { HrRequestIssueIndicator } from '../types/hrRequest'
import { sortCollectionYearsByLabelValue, sortCollectionYearLabels } from './collectionYearSort'
import {
  AGE_KEYS,
  AGE_LABELS,
  DISABILITY_KEYS,
  DISABILITY_LABELS,
} from './indicatorDisaggregation'

export type IndicatorCollectionLine = {
  year_id: number
  label: string
}

/** @deprecated use IndicatorCollectionLine */
export type IndicatorYearGenderLine = IndicatorCollectionLine

export type IndicatorCollectionDisaggregation = Pick<
  HrRequestIssueIndicator,
  | 'collects_by_year'
  | 'collects_by_gender'
  | 'collects_by_age'
  | 'collects_by_location'
  | 'collects_by_disability'
  | 'collects_by_religion'
  | 'collects_by_others'
  | 'collection_by_year'
  | 'disaggregation'
>

export function indicatorCollectionDisaggregationFromApi(
  ind: HrRequestIssueIndicator,
): IndicatorCollectionDisaggregation {
  return {
    collects_by_year: ind.collects_by_year,
    collects_by_gender: ind.collects_by_gender,
    collects_by_age: ind.collects_by_age,
    collects_by_location: ind.collects_by_location,
    collects_by_disability: ind.collects_by_disability,
    collects_by_religion: ind.collects_by_religion,
    collects_by_others: ind.collects_by_others,
    collection_by_year: ind.collection_by_year,
    disaggregation: ind.disaggregation,
  }
}

/** All configured dimension names (Gender included) — no sub-column names. */
export function indicatorAllDimensionLabelNames(
  ind: Pick<
    HrRequestIssueIndicator,
    | 'collects_by_gender'
    | 'collects_by_age'
    | 'collects_by_location'
    | 'collects_by_disability'
    | 'collects_by_religion'
    | 'collects_by_others'
  >,
): string[] {
  const labels: string[] = []
  if (ind.collects_by_gender) labels.push('Gender')
  if (ind.collects_by_age) labels.push('Age')
  if (ind.collects_by_location) labels.push('Location')
  if (ind.collects_by_disability) labels.push('Disability')
  if (ind.collects_by_religion) labels.push('Religion')
  if (ind.collects_by_others) labels.push('Others')
  return labels
}

export function indicatorCollectionLines(
  ind: Pick<
    HrRequestIssueIndicator,
    | 'collects_by_year'
    | 'collects_by_gender'
    | 'collects_by_age'
    | 'collects_by_location'
    | 'collects_by_disability'
    | 'collects_by_religion'
    | 'collects_by_others'
    | 'collection_by_year'
    | 'has_quantitative'
  >,
): IndicatorCollectionLine[] {
  if (ind.has_quantitative === false) return []
  if (!ind.collects_by_year || !ind.collection_by_year?.length) {
    return []
  }
  return sortCollectionYearsByLabelValue(
    ind.collection_by_year.map((y) => ({
      year_id: y.year_id,
      label: y.label,
    })),
  )
}

/** Qualitative narrative years (never used as quantitative matrix columns). */
export function indicatorQualitativeCollectionLines(
  ind: Pick<HrRequestIssueIndicator, 'has_qualitative' | 'qualitative_collection_by_year'>,
): IndicatorCollectionLine[] {
  if (!ind.has_qualitative || !ind.qualitative_collection_by_year?.length) {
    return []
  }
  return sortCollectionYearsByLabelValue(
    ind.qualitative_collection_by_year.map((y) => ({
      year_id: y.year_id,
      label: y.label,
    })),
  )
}

export function formatIndicatorCollectionSummary(
  ind: Pick<
    HrRequestIssueIndicator,
    | 'collects_by_year'
    | 'collects_by_gender'
    | 'collects_by_age'
    | 'collects_by_location'
    | 'collects_by_disability'
    | 'collects_by_religion'
    | 'collects_by_others'
    | 'collection_by_year'
    | 'disaggregation'
  >,
): string | null {
  const lines = indicatorCollectionLines(ind)
  if (lines.length === 0) {
    const text = ind.disaggregation?.trim()
    return text || null
  }
  const dims = indicatorAllDimensionLabelNames(ind)
  const yearPart = sortCollectionYearLabels(lines.map((line) => line.label)).join('; ')
  if (dims.length === 0) return yearPart
  return `${yearPart} (${dims.join(', ')})`
}

/** @deprecated use indicatorCollectionLines */
export function indicatorYearGenderLines(
  ind: Pick<HrRequestIssueIndicator, 'collects_by_year' | 'collects_by_gender' | 'collection_by_year'>,
) {
  return indicatorCollectionLines(ind)
}

/** @deprecated use formatIndicatorCollectionSummary */
export function formatIndicatorYearGenderSummary(
  ind: Pick<
    HrRequestIssueIndicator,
    | 'collects_by_year'
    | 'collects_by_gender'
    | 'collects_by_age'
    | 'collects_by_location'
    | 'collects_by_disability'
    | 'collects_by_religion'
    | 'collects_by_others'
    | 'collection_by_year'
    | 'disaggregation'
  >,
): string | null {
  return formatIndicatorCollectionSummary(ind)
}

/** @deprecated Prefer indicatorAllDimensionLabelNames (includes Gender). */
export function indicatorDimensionLabelNames(
  ind: Pick<
    HrRequestIssueIndicator,
    | 'collects_by_gender'
    | 'collects_by_age'
    | 'collects_by_location'
    | 'collects_by_disability'
    | 'collects_by_religion'
    | 'collects_by_others'
  >,
): string[] {
  return indicatorAllDimensionLabelNames(ind)
}

/** Detailed option labels — for department data-entry contexts only (matrix tables). */
export function indicatorDimensionHints(ind: HrRequestIssueIndicator): string[] {
  const hints: string[] = []
  if (ind.collects_by_age) {
    hints.push(`Age: ${AGE_KEYS.map((key) => AGE_LABELS[key]).join(', ')}`)
  }
  if (ind.collects_by_location) {
    hints.push('Location: all regions and districts')
  }
  if (ind.collects_by_disability) {
    hints.push(`Disability: ${DISABILITY_LABELS[DISABILITY_KEYS[0]]}`)
  }
  if (ind.collects_by_religion) {
    hints.push('Religion: full catalog (all options)')
  }
  if (ind.collects_by_others) {
    hints.push('Others: Total count only')
  }
  return hints
}
