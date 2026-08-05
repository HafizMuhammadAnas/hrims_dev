import type { HrRequestIssueIndicator } from '../types/hrRequest'
import { indicatorIsYearOnly } from './indicatorDisaggregation'

export type MatrixDimensionKey =
  | 'gender'
  | 'age'
  | 'disability'
  | 'district'
  | 'religion'
  | 'consolidated'

export const MATRIX_DIMENSION_KEYS: MatrixDimensionKey[] = [
  'gender',
  'age',
  'religion',
  'district',
  'disability',
  'consolidated',
]

export type MatrixRowEnabledMap = Partial<Record<MatrixDimensionKey, boolean>>

/** Rows are included by default unless explicitly set to false. */
export function isMatrixRowEnabled(
  enabled: MatrixRowEnabledMap | undefined,
  dimension: MatrixDimensionKey,
): boolean {
  return enabled?.[dimension] !== false
}

export function indicatorAppliesToMatrixDimension(
  ind: HrRequestIssueIndicator,
  dimension: MatrixDimensionKey,
): boolean {
  if (!ind.collects_by_year) return false
  switch (dimension) {
    case 'gender':
      return indicatorIsYearOnly(ind) || Boolean(ind.collects_by_gender)
    case 'age':
      return Boolean(ind.collects_by_age)
    case 'disability':
      return Boolean(ind.collects_by_disability)
    case 'district':
      return Boolean(ind.collects_by_location)
    case 'religion':
      return Boolean(ind.collects_by_religion)
    case 'consolidated':
      return Boolean(ind.collects_by_consolidated)
    default:
      return false
  }
}

export function parseMatrixRowEnabled(
  raw: Partial<Record<MatrixDimensionKey | 'others', boolean>> | null | undefined,
): MatrixRowEnabledMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: MatrixRowEnabledMap = {}
  for (const key of MATRIX_DIMENSION_KEYS) {
    if (typeof raw[key] === 'boolean') {
      out[key] = raw[key]
    }
  }
  if (out.consolidated == null && typeof raw.others === 'boolean') {
    out.consolidated = raw.others
  }
  return out
}

export function serializeMatrixRowEnabled(
  enabled: MatrixRowEnabledMap | undefined,
): MatrixRowEnabledMap | undefined {
  if (!enabled) return undefined
  const out: MatrixRowEnabledMap = {}
  for (const key of MATRIX_DIMENSION_KEYS) {
    if (enabled[key] === false) {
      out[key] = false
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}
