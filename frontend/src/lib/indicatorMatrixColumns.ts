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

export {
  buildGenderMatrixGroups as buildMatrixColumnGroups,
  indicatorGenderCellAllowed as indicatorMatrixCellAllowed,
  forEachGenderMatrixCell as forEachIndicatorMatrixCell,
  indicatorUsesAnyDataMatrix as indicatorUsesDataMatrix,
  deptFormUsesAnyIndicatorMatrix as deptFormUsesIndicatorMatrix,
} from './indicatorDisaggregation'
