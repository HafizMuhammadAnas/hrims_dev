import type { CollectionReligionRow } from '../api/collectionReligions'
import type { DistrictRow } from '../api/districts'
import type { DeptIndicatorDraft } from '../components/DepartmentIndicatorSupplementaryFields'
import { isMatrixRowEnabled } from './deptMatrixRowEnabled'
import {
  AGE_KEYS,
  DISABILITY_KEYS,
  indicatorCatalogCellAllowed,
  indicatorConfiguredYears,
  indicatorFixedKeyCellAllowed,
  indicatorGenderCellAllowed,
  indicatorIsYearOnly,
  indicatorReligionCellAllowed,
  indicatorRequiresQuantitativeMatrixPayload,
} from './indicatorDisaggregation'
import { isSelectableCollectionGender } from './collectionGenderOptions'
import {
  DIMENSION_TOTAL_COLUMN_ID,
  YEAR_ONLY_GENDER_ID,
  genderTotalCellKey,
  matrixCellKey,
} from './indicatorMatrixColumns'
import type { HrRequestIssueIndicator } from '../types/hrRequest'

function num(v: string | number | '' | undefined | null): number {
  if (v === '' || v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function resolveCellKey(yearId: number, columnId: number | string): string {
  if (columnId === DIMENSION_TOTAL_COLUMN_ID) return genderTotalCellKey(yearId)
  if (typeof columnId === 'string') return `${yearId}-${columnId}`
  return matrixCellKey(yearId, columnId)
}

function readDraftCell(
  values: Record<string, string> | undefined,
  yearId: number,
  columnId: number | string,
): number {
  return num(values?.[resolveCellKey(yearId, columnId)])
}

function sumDraftColumns(
  values: Record<string, string> | undefined,
  yearId: number,
  columnIds: ReadonlyArray<number | string>,
  allowed: (columnId: number | string) => boolean,
): number {
  let sum = 0
  for (const columnId of columnIds) {
    if (!allowed(columnId)) continue
    sum += readDraftCell(values, yearId, columnId)
  }
  return sum
}

function genderBreakdownColumnIds(ind: HrRequestIssueIndicator): number[] {
  if (indicatorIsYearOnly(ind) || !ind.collects_by_gender) return []
  const ids = new Set<number>()
  for (const y of ind.collection_by_year ?? []) {
    for (const g of y.genders ?? []) {
      if (!isSelectableCollectionGender(g.name)) continue
      ids.add(g.id)
    }
  }
  return [...ids]
}

/**
 * Year-total source mirrors DepartmentIndicatorDisaggregationMatrices:
 * consolidated → year_only → gender totals column.
 */
function yearTotalForDraft(
  ind: HrRequestIssueIndicator,
  draft: DeptIndicatorDraft,
  yearId: number,
): number | null {
  const showConsolidated = Boolean(ind.collects_by_consolidated)
  const showYearOnlyGender = indicatorIsYearOnly(ind) && !showConsolidated
  const hasGenderBreakdown = Boolean(ind.collects_by_gender) && !showConsolidated

  if (showConsolidated) {
    if (!isMatrixRowEnabled(draft.matrixRowEnabled, 'consolidated')) return null
    return readDraftCell(draft.yearConsolidatedValues, yearId, DIMENSION_TOTAL_COLUMN_ID)
  }
  if (showYearOnlyGender) {
    if (!isMatrixRowEnabled(draft.matrixRowEnabled, 'gender')) return null
    return readDraftCell(draft.yearGenderValues, yearId, YEAR_ONLY_GENDER_ID)
  }
  if (hasGenderBreakdown) {
    if (!isMatrixRowEnabled(draft.matrixRowEnabled, 'gender')) return null
    return readDraftCell(draft.yearGenderValues, yearId, DIMENSION_TOTAL_COLUMN_ID)
  }
  return null
}

export type DeptYearTotalOverrun = {
  indicatorId: number
  indicatorLabel: string
  dimension: string
  yearLabel: string
  yearTotal: number
  distributed: number
}

/**
 * True when any enabled disaggregate breakdown sums above the year total
 * (Unaccounted would be negative in the IWD UI).
 */
export function findDeptIndicatorYearTotalOverruns(
  indicators: HrRequestIssueIndicator[],
  drafts: Record<number, DeptIndicatorDraft>,
  districts: Array<Pick<DistrictRow, 'id' | 'name'>>,
  religions: Array<Pick<CollectionReligionRow, 'id' | 'name'>>,
): DeptYearTotalOverrun[] {
  const overruns: DeptYearTotalOverrun[] = []

  for (const ind of indicators) {
    if (!indicatorRequiresQuantitativeMatrixPayload(ind)) continue
    const draft = drafts[ind.id]
    if (!draft) continue

    const years = indicatorConfiguredYears(ind)
    const label = ind.indicator_text?.trim() || `Indicator #${ind.id}`

    for (const y of years) {
      const yt = yearTotalForDraft(ind, draft, y.year_id)
      if (yt == null) continue

      const checks: Array<{
        dimension: string
        enabled: boolean
        distributed: number
      }> = []

      const genderIds = genderBreakdownColumnIds(ind)
      if (ind.collects_by_gender && genderIds.length > 0) {
        checks.push({
          dimension: 'Gender',
          enabled: isMatrixRowEnabled(draft.matrixRowEnabled, 'gender'),
          distributed: sumDraftColumns(
            draft.yearGenderValues,
            y.year_id,
            genderIds,
            (columnId) => indicatorGenderCellAllowed(ind, y.year_id, Number(columnId)),
          ),
        })
      }

      if (ind.collects_by_age) {
        checks.push({
          dimension: 'Age',
          enabled: isMatrixRowEnabled(draft.matrixRowEnabled, 'age'),
          distributed: sumDraftColumns(
            draft.yearAgeValues,
            y.year_id,
            AGE_KEYS,
            (columnId) =>
              indicatorFixedKeyCellAllowed(
                ind,
                y.year_id,
                (i) => Boolean(i.collects_by_age),
                AGE_KEYS,
                String(columnId),
              ),
          ),
        })
      }

      if (ind.collects_by_disability) {
        checks.push({
          dimension: 'PWDs',
          enabled: isMatrixRowEnabled(draft.matrixRowEnabled, 'disability'),
          distributed: sumDraftColumns(
            draft.yearDisabilityValues,
            y.year_id,
            DISABILITY_KEYS,
            (columnId) =>
              indicatorFixedKeyCellAllowed(
                ind,
                y.year_id,
                (i) => Boolean(i.collects_by_disability),
                DISABILITY_KEYS,
                String(columnId),
              ),
          ),
        })
      }

      if (ind.collects_by_location && districts.length > 0) {
        const districtIds = districts.map((d) => d.id)
        checks.push({
          dimension: 'District',
          enabled: isMatrixRowEnabled(draft.matrixRowEnabled, 'district'),
          distributed: sumDraftColumns(
            draft.yearDistrictValues,
            y.year_id,
            districtIds,
            (columnId) =>
              indicatorCatalogCellAllowed(
                ind,
                y.year_id,
                (i) => Boolean(i.collects_by_location),
                Number(columnId),
              ),
          ),
        })
      }

      if (ind.collects_by_religion && religions.length > 0) {
        const religionIds = religions.map((r) => r.id)
        checks.push({
          dimension: 'Religion',
          enabled: isMatrixRowEnabled(draft.matrixRowEnabled, 'religion'),
          distributed: sumDraftColumns(
            draft.yearReligionValues,
            y.year_id,
            religionIds,
            (columnId) => indicatorReligionCellAllowed(ind, y.year_id, Number(columnId)),
          ),
        })
      }

      for (const check of checks) {
        if (!check.enabled) continue
        if (check.distributed > yt) {
          overruns.push({
            indicatorId: ind.id,
            indicatorLabel: label,
            dimension: check.dimension,
            yearLabel: y.label,
            yearTotal: yt,
            distributed: check.distributed,
          })
        }
      }
    }
  }

  return overruns
}

export function deptIndicatorYearTotalsWithinBudget(
  indicators: HrRequestIssueIndicator[],
  drafts: Record<number, DeptIndicatorDraft>,
  districts: Array<Pick<DistrictRow, 'id' | 'name'>>,
  religions: Array<Pick<CollectionReligionRow, 'id' | 'name'>>,
): boolean {
  return findDeptIndicatorYearTotalOverruns(indicators, drafts, districts, religions).length === 0
}

export function formatDeptYearTotalOverrunMessage(overruns: DeptYearTotalOverrun[]): string {
  const first = overruns[0]
  if (!first) return ''
  const more = overruns.length > 1 ? ` (+${overruns.length - 1} more)` : ''
  return `${first.indicatorLabel}: ${first.dimension} for ${first.yearLabel} distributed (${first.distributed}) exceeds year total (${first.yearTotal}).${more}`
}
