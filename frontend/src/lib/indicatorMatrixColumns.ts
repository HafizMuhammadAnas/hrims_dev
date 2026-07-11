/** Synthetic gender id for year-only matrix cells (no gender breakdown). */
export const YEAR_ONLY_GENDER_ID = 0

export const YEAR_ONLY_GENDER_LABEL = 'Value'

/** Column id for the editable year total in the Gender matrix (stored in by_year_gender). */
export const GENDER_TOTAL_COLUMN_ID = 'total'

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

export function genderTotalCellKey(yearId: number): string {
  return `${yearId}-${GENDER_TOTAL_COLUMN_ID}`
}

export {
  buildGenderMatrixGroups as buildMatrixColumnGroups,
  indicatorGenderCellAllowed as indicatorMatrixCellAllowed,
  forEachGenderMatrixCell as forEachIndicatorMatrixCell,
  indicatorUsesAnyDataMatrix as indicatorUsesDataMatrix,
  deptFormUsesAnyIndicatorMatrix as deptFormUsesIndicatorMatrix,
} from './indicatorDisaggregation'
