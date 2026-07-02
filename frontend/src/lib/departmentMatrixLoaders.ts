import type { DepartmentQuantitativeByYearKeyed } from '../lib/departmentTaskResponseFormat'
import { fixedKeyMatrixCellKey } from '../lib/indicatorDisaggregation'
import { matrixCellKey } from '../lib/indicatorMatrixColumns'

/** Blank matrix inputs are stored and submitted as zero. */
export function matrixCellNumericValue(raw: string | undefined | null): string {
  const v = (raw ?? '').trim()
  if (v === '') return '0'
  return v
}

/** True when empty (will count as zero) or a valid number. */
export function matrixCellInputReady(raw: string | undefined | null): boolean {
  const v = (raw ?? '').trim()
  if (v === '') return true
  return Number.isFinite(Number(v))
}

export function loadYearKeyedValuesFromBundle(
  byYear: DepartmentQuantitativeByYearKeyed | null | undefined,
  useNumericGenderIds = true,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!byYear) return out
  for (const [yearKey, cells] of Object.entries(byYear)) {
    for (const [cellKey, cell] of Object.entries(cells)) {
      if (cell?.value == null || Number.isNaN(cell.value)) continue
      const yearId = Number(yearKey)
      if (useNumericGenderIds && Number.isFinite(Number(cellKey))) {
        out[matrixCellKey(yearId, Number(cellKey))] = String(cell.value)
      } else {
        out[fixedKeyMatrixCellKey(yearId, cellKey)] = String(cell.value)
      }
    }
  }
  return out
}
