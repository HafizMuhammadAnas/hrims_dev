import type { HrRequestIssueIndicator } from '../types/hrRequest'

import { compareCollectionYearLabels } from './collectionYearSort'
import { isSelectableCollectionGender } from './collectionGenderOptions'

import {

  YEAR_ONLY_GENDER_ID,

  YEAR_ONLY_GENDER_LABEL,

  matrixCellKey,

  type MatrixYearColumnGroup,

} from './indicatorMatrixColumns'



export const AGE_UNDER_18 = 'under_18' as const

export const AGE_18_60 = 'age_18_60' as const

export const AGE_ABOVE_60 = 'above_60' as const

export const AGE_KEYS = [AGE_UNDER_18, AGE_18_60, AGE_ABOVE_60] as const



/** @deprecated Legacy key — kept for read-only display of older submissions. */

export const AGE_OVER_18 = 'over_18' as const



export const DISABILITY_PERSONS_WITH_DISABILITY = 'persons_with_disability' as const

export const DISABILITY_KEYS = [DISABILITY_PERSONS_WITH_DISABILITY] as const



/** @deprecated Legacy keys — kept for read-only display of older submissions. */

export const DISABILITY_YES = 'yes' as const

/** @deprecated Legacy keys — kept for read-only display of older submissions. */

export const DISABILITY_NO = 'no' as const



export const AGE_LABELS: Record<string, string> = {

  [AGE_UNDER_18]: 'Under 18',

  [AGE_18_60]: '18 - 60',

  [AGE_ABOVE_60]: 'Above 60',

  [AGE_OVER_18]: '18+',

}



export const DISABILITY_LABELS: Record<string, string> = {

  [DISABILITY_PERSONS_WITH_DISABILITY]: 'Persons with disability',

  [DISABILITY_YES]: 'Yes',

  [DISABILITY_NO]: 'No',

}



export type DisaggregationDimension =

  | 'gender'

  | 'age'

  | 'disability'

  | 'region'

  | 'district'

  | 'religion'

  | 'others'



export type LocationCatalogItem = { id: number; name: string }



export function indicatorUsesDisaggregatedDimensions(ind: HrRequestIssueIndicator): boolean {

  return Boolean(

    ind.collects_by_gender ||

      ind.collects_by_age ||

      ind.collects_by_location ||

      ind.collects_by_disability ||

      ind.collects_by_religion ||

      ind.collects_by_others,

  )

}



export function indicatorIsYearOnly(ind: HrRequestIssueIndicator): boolean {

  return Boolean(
    ind.has_quantitative &&
      ind.collects_by_year &&
      !indicatorUsesDisaggregatedDimensions(ind),
  )

}



/** Quantitative years for numeric matrices only (never qualitative narrative years). */
export function indicatorConfiguredYears(ind: HrRequestIssueIndicator): Array<{ year_id: number; label: string }> {

  if (!ind.has_quantitative) return []

  const years = (ind.collection_by_year ?? []).map((y) => ({ year_id: y.year_id, label: y.label }))

  return years.sort((a, b) => compareCollectionYearLabels(a.label, b.label))

}



/** Qualitative years for per-year narrative text entry/view. */
export function indicatorQualitativeYears(ind: HrRequestIssueIndicator): Array<{ year_id: number; label: string }> {

  if (!ind.has_qualitative) return []

  const years = (ind.qualitative_collection_by_year ?? []).map((y) => ({
    year_id: y.year_id,
    label: y.label,
  }))

  return years.sort((a, b) => compareCollectionYearLabels(a.label, b.label))

}



function sortYearGroups(groups: MatrixYearColumnGroup[]): MatrixYearColumnGroup[] {

  return [...groups].sort((a, b) => compareCollectionYearLabels(a.year_label, b.year_label))

}



export function buildGenderMatrixGroups(indicators: HrRequestIssueIndicator[]): MatrixYearColumnGroup[] {

  const yearMap = new Map<number, { label: string; genders: Map<number, string> }>()



  for (const ind of indicators) {

    if (!ind.has_quantitative || !ind.collects_by_year) continue

    if (indicatorIsYearOnly(ind)) {

      for (const y of ind.collection_by_year ?? []) {

        const existing = yearMap.get(y.year_id) ?? { label: y.label, genders: new Map<number, string>() }

        existing.label = y.label || existing.label

        existing.genders.set(YEAR_ONLY_GENDER_ID, YEAR_ONLY_GENDER_LABEL)

        yearMap.set(y.year_id, existing)

      }

      continue

    }

    if (!ind.collects_by_gender) continue

    for (const y of ind.collection_by_year ?? []) {

      const existing = yearMap.get(y.year_id) ?? { label: y.label, genders: new Map<number, string>() }

      existing.label = y.label || existing.label

      for (const g of y.genders ?? []) {

        if (!isSelectableCollectionGender(g.name)) continue

        existing.genders.set(g.id, g.name)

      }

      yearMap.set(y.year_id, existing)

    }

  }



  return sortYearGroups(

    [...yearMap.entries()].map(([year_id, row]) => ({

      year_id,

      year_label: row.label,

      genders: [...row.genders.entries()]

        .sort(([aId], [bId]) => {

          if (aId === YEAR_ONLY_GENDER_ID) return -1

          if (bId === YEAR_ONLY_GENDER_ID) return 1

          return (row.genders.get(aId) ?? '').localeCompare(row.genders.get(bId) ?? '', undefined, {

            sensitivity: 'base',

          })

        })

        .map(([gender_id, gender_name]) => ({ gender_id, gender_name })),

    })),

  )

}



export function buildFixedKeyMatrixGroups(

  indicators: HrRequestIssueIndicator[],

  _dimension: 'age' | 'disability',

  enabled: (ind: HrRequestIssueIndicator) => boolean,

  keys: readonly string[],

  labels: Record<string, string>,

): MatrixYearColumnGroup[] {

  const yearMap = new Map<number, string>()

  for (const ind of indicators) {

    if (!ind.collects_by_year || !enabled(ind)) continue

    for (const y of ind.collection_by_year ?? []) {

      yearMap.set(y.year_id, y.label || yearMap.get(y.year_id) || '')

    }

  }

  return sortYearGroups(

    [...yearMap.entries()].map(([year_id, year_label]) => ({

      year_id,

      year_label,

      genders: keys.map((key) => ({

        gender_id: key as unknown as number,

        gender_name: labels[key] ?? key,

      })),

    })),

  )

}



export function buildCatalogMatrixGroups(

  indicators: HrRequestIssueIndicator[],

  enabled: (ind: HrRequestIssueIndicator) => boolean,

  catalog: LocationCatalogItem[],

): MatrixYearColumnGroup[] {

  const yearMap = new Map<number, string>()

  for (const ind of indicators) {

    if (!ind.collects_by_year || !enabled(ind)) continue

    for (const y of ind.collection_by_year ?? []) {

      yearMap.set(y.year_id, y.label || yearMap.get(y.year_id) || '')

    }

  }

  return sortYearGroups(

    [...yearMap.entries()].map(([year_id, year_label]) => ({

      year_id,

      year_label,

      genders: catalog.map((item) => ({

        gender_id: item.id,

        gender_name: item.name,

      })),

    })),

  )

}



export function buildReligionMatrixGroups(

  indicators: HrRequestIssueIndicator[],

  catalog: LocationCatalogItem[],

): MatrixYearColumnGroup[] {

  return buildCatalogMatrixGroups(

    indicators,

    (ind) => Boolean(ind.collects_by_religion),

    catalog,

  )

}



export function indicatorGenderCellAllowed(

  ind: HrRequestIssueIndicator,

  yearId: number,

  genderId: number,

): boolean {

  const yearRow = (ind.collection_by_year ?? []).find((y) => y.year_id === yearId)

  if (!yearRow) return false

  if (indicatorIsYearOnly(ind)) return genderId === YEAR_ONLY_GENDER_ID

  if (!ind.collects_by_gender) return false

  return (yearRow.genders ?? []).some((g) => g.id === genderId)

}



export function indicatorFixedKeyCellAllowed(

  ind: HrRequestIssueIndicator,

  yearId: number,

  enabled: (i: HrRequestIssueIndicator) => boolean,

  keys: readonly string[],

  cellKey: string,

): boolean {

  if (!ind.collects_by_year || !enabled(ind)) return false

  if (!(ind.collection_by_year ?? []).some((y) => y.year_id === yearId)) return false

  return keys.includes(cellKey)

}



export function indicatorCatalogCellAllowed(

  ind: HrRequestIssueIndicator,

  yearId: number,

  enabled: (i: HrRequestIssueIndicator) => boolean,

  _catalogId: number,

): boolean {

  if (!ind.collects_by_year || !enabled(ind)) return false

  return (ind.collection_by_year ?? []).some((y) => y.year_id === yearId)

}



export function indicatorReligionCellAllowed(

  ind: HrRequestIssueIndicator,

  yearId: number,

  _religionId: number,

): boolean {

  return indicatorCatalogCellAllowed(ind, yearId, (i) => Boolean(i.collects_by_religion), _religionId)

}



export function forEachReligionMatrixCell(

  ind: HrRequestIssueIndicator,

  catalog: LocationCatalogItem[],

  fn: (yearId: number, religionId: number) => void,

): void {

  forEachCatalogMatrixCell(ind, (i) => Boolean(i.collects_by_religion), catalog, fn)

}



export function forEachGenderMatrixCell(

  ind: HrRequestIssueIndicator,

  fn: (yearId: number, genderId: number) => void,

): void {

  if (!ind.collects_by_year) return

  for (const y of ind.collection_by_year ?? []) {

    if (indicatorIsYearOnly(ind)) {

      fn(y.year_id, YEAR_ONLY_GENDER_ID)

      continue

    }

    if (!ind.collects_by_gender) continue

    for (const g of y.genders ?? []) {

      fn(y.year_id, g.id)

    }

  }

}



export function forEachFixedKeyMatrixCell(

  ind: HrRequestIssueIndicator,

  enabled: (i: HrRequestIssueIndicator) => boolean,

  keys: readonly string[],

  fn: (yearId: number, cellKey: string) => void,

): void {

  if (!ind.collects_by_year || !enabled(ind)) return

  for (const y of ind.collection_by_year ?? []) {

    for (const key of keys) {

      fn(y.year_id, key)

    }

  }

}



export function forEachCatalogMatrixCell(

  ind: HrRequestIssueIndicator,

  enabled: (i: HrRequestIssueIndicator) => boolean,

  catalog: LocationCatalogItem[],

  fn: (yearId: number, catalogId: number) => void,

): void {

  if (!ind.collects_by_year || !enabled(ind)) return

  for (const y of ind.collection_by_year ?? []) {

    for (const item of catalog) {

      fn(y.year_id, item.id)

    }

  }

}



export function fixedKeyMatrixCellKey(yearId: number, cellKey: string): string {

  return `${yearId}-${cellKey}`

}



export function catalogMatrixCellKey(yearId: number, catalogId: number): string {

  return matrixCellKey(yearId, catalogId)

}



export function indicatorUsesAnyDataMatrix(ind: HrRequestIssueIndicator): boolean {

  if (!ind.has_quantitative) return false

  if (!ind.collects_by_year || (ind.collection_by_year?.length ?? 0) === 0) return false

  return (

    indicatorIsYearOnly(ind) ||

    Boolean(ind.collects_by_gender) ||

    Boolean(ind.collects_by_age) ||

    Boolean(ind.collects_by_location) ||

    Boolean(ind.collects_by_disability) ||

    Boolean(ind.collects_by_religion) ||

    Boolean(ind.collects_by_others)

  )

}



export function indicatorRequiresQuantitativeMatrixPayload(ind: HrRequestIssueIndicator): boolean {

  return Boolean(ind.has_quantitative) && indicatorUsesAnyDataMatrix(ind)

}



export function deptFormUsesAnyIndicatorMatrix(indicators: HrRequestIssueIndicator[]): boolean {

  return indicators.some((ind) => indicatorUsesAnyDataMatrix(ind))

}



/** Year groups with no breakdown columns — used for Others (Total-only per year). */

export function buildYearTotalOnlyMatrixGroups(

  indicators: HrRequestIssueIndicator[],

  enabled: (ind: HrRequestIssueIndicator) => boolean,

): MatrixYearColumnGroup[] {

  const years = new Map<number, string>()

  for (const ind of indicators) {

    if (!enabled(ind)) continue

    for (const y of indicatorConfiguredYears(ind)) {

      if (!years.has(y.year_id)) years.set(y.year_id, y.label)

    }

  }

  return [...years.entries()]

    .sort((a, b) => compareCollectionYearLabels(a[1], b[1]))

    .map(([year_id, year_label]) => ({ year_id, year_label, genders: [] }))

}



export { matrixCellKey, YEAR_ONLY_GENDER_ID }

