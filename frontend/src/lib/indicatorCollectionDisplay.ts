import type { HrRequestIssueIndicator } from '../types/hrRequest'
import { isSelectableCollectionGender } from './collectionGenderOptions'
import {
  AGE_KEYS,
  AGE_LABELS,
  DISABILITY_KEYS,
  DISABILITY_LABELS,
} from './indicatorDisaggregation'

export type IndicatorCollectionLine = {
  year_id: number
  label: string
  genders: string[]
  religions: string[]
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
    collection_by_year: ind.collection_by_year,
    disaggregation: ind.disaggregation,
  }
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
    | 'collection_by_year'
  >,
): IndicatorCollectionLine[] {
  if (!ind.collects_by_year || !ind.collection_by_year?.length) {
    return []
  }
  return ind.collection_by_year.map((y) => ({
    year_id: y.year_id,
    label: y.label,
    genders: ind.collects_by_gender
      ? (y.genders ?? []).map((g) => g.name).filter((name) => Boolean(name) && isSelectableCollectionGender(name))
      : [],
    religions: ind.collects_by_religion ? [] : [],
  }))
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
    | 'collection_by_year'
    | 'disaggregation'
  >,
): string | null {
  const lines = indicatorCollectionLines(ind)
  if (lines.length === 0) {
    const text = ind.disaggregation?.trim()
    return text || null
  }
  const dims: string[] = []
  if (ind.collects_by_gender) dims.push('Gender')
  if (ind.collects_by_age) dims.push('Age')
  if (ind.collects_by_location) dims.push('Location')
  if (ind.collects_by_disability) dims.push('Disability')
  if (ind.collects_by_religion) dims.push('Religion')
  if (dims.length === 0) {
    return lines.map((line) => line.label).join('; ')
  }
  return `${lines.map((line) => line.label).join('; ')} (${dims.join(', ')})`
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
    | 'collection_by_year'
    | 'disaggregation'
  >,
): string | null {
  return formatIndicatorCollectionSummary(ind)
}

export function indicatorDimensionLabelNames(
  ind: Pick<
    HrRequestIssueIndicator,
    'collects_by_age' | 'collects_by_location' | 'collects_by_disability' | 'collects_by_religion'
  >,
): string[] {
  const labels: string[] = []
  if (ind.collects_by_age) labels.push('Age')
  if (ind.collects_by_location) labels.push('Location')
  if (ind.collects_by_disability) labels.push('Disability')
  if (ind.collects_by_religion) labels.push('Religion')
  return labels
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
  return hints
}
