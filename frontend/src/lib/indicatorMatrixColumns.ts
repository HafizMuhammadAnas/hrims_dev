/** Synthetic gender id for year-only matrix cells (no gender breakdown). */
export const YEAR_ONLY_GENDER_ID = 0

export const YEAR_ONLY_GENDER_LABEL = 'Value'

/**
 * Column id for the editable year Total in each disaggregation matrix
 * (stored as `total` under by_year_gender / by_year_age / …).
 */
export const DIMENSION_TOTAL_COLUMN_ID = 'total'
/** @deprecated Prefer DIMENSION_TOTAL_COLUMN_ID — kept for existing gender call sites. */
export const GENDER_TOTAL_COLUMN_ID = DIMENSION_TOTAL_COLUMN_ID

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

export function dimensionTotalCellKey(yearId: number): string {
  return `${yearId}-${DIMENSION_TOTAL_COLUMN_ID}`
}

/** @deprecated Prefer dimensionTotalCellKey */
export function genderTotalCellKey(yearId: number): string {
  return dimensionTotalCellKey(yearId)
}

export {
  buildGenderMatrixGroups as buildMatrixColumnGroups,
  indicatorGenderCellAllowed as indicatorMatrixCellAllowed,
  forEachGenderMatrixCell as forEachIndicatorMatrixCell,
  indicatorUsesAnyDataMatrix as indicatorUsesDataMatrix,
  deptFormUsesAnyIndicatorMatrix as deptFormUsesIndicatorMatrix,
} from './indicatorDisaggregation'
