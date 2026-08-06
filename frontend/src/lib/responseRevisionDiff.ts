import {
  parseDepartmentTaskResponseData,
  type DepartmentIndicatorBundle,
  type DepartmentIndicatorPayload,
  type DepartmentQuantitativeByYearGender,
  type DepartmentQuantitativeByYearKeyed,
} from './departmentTaskResponseFormat'

export type ResponseRevisionHighlight = {
  /** `${indicatorId}|${dimension}|${yearId}|${columnId}` */
  matrixCells: Set<string>
  /** `${indicatorId}|${yearId}` — year totals bar / consolidated total */
  yearTotals: Set<string>
  /** Indicator ids whose quantitative comment changed */
  comments: Set<string>
  /** Indicator ids whose legacy quantitative number changed */
  values: Set<string>
  /** `${indicatorId}|${yearKey}` where yearKey is year id or `legacy` */
  qualTexts: Set<string>
  challenges: boolean
}

const MATRIX_DIMS = [
  'gender',
  'age',
  'disability',
  'district',
  'religion',
  'consolidated',
] as const

type MatrixDim = (typeof MATRIX_DIMS)[number]

function emptyHighlight(): ResponseRevisionHighlight {
  return {
    matrixCells: new Set(),
    yearTotals: new Set(),
    comments: new Set(),
    values: new Set(),
    qualTexts: new Set(),
    challenges: false,
  }
}

function normText(v: string | null | undefined): string {
  return (v ?? '').trim()
}

function cellNum(v: unknown): string {
  if (v == null || v === '') return ''
  if (typeof v === 'object' && v !== null && 'value' in v) {
    const n = (v as { value?: unknown }).value
    if (n == null || n === '') return ''
    const num = Number(n)
    return Number.isFinite(num) ? String(num) : String(n)
  }
  const num = Number(v)
  return Number.isFinite(num) ? String(num) : String(v)
}

function keyedBundle(
  q: DepartmentIndicatorBundle['quantitative'],
  dim: MatrixDim,
): DepartmentQuantitativeByYearGender | DepartmentQuantitativeByYearKeyed | null | undefined {
  if (!q) return null
  switch (dim) {
    case 'gender':
      return q.by_year_gender
    case 'age':
      return q.by_year_age
    case 'disability':
      return q.by_year_disability
    case 'district':
      return q.by_year_district
    case 'religion':
      return q.by_year_religion
    case 'consolidated':
      return q.by_year_consolidated ?? q.by_year_others
  }
}

function collectKeyedPaths(
  bundle: DepartmentQuantitativeByYearGender | DepartmentQuantitativeByYearKeyed | null | undefined,
): Map<string, string> {
  const out = new Map<string, string>()
  if (!bundle) return out
  for (const [yearId, cells] of Object.entries(bundle)) {
    if (!cells || typeof cells !== 'object') continue
    for (const [columnId, cell] of Object.entries(cells)) {
      out.set(`${yearId}|${columnId}`, cellNum(cell))
    }
  }
  return out
}

function payloadFromRaw(raw: string | null | undefined): DepartmentIndicatorPayload | null {
  const parsed = parseDepartmentTaskResponseData(raw)
  return parsed.kind === 'structured' ? parsed.payload : null
}

function challengesOf(payload: DepartmentIndicatorPayload | null): string {
  if (!payload) return ''
  const root = normText(payload.challenges)
  if (root) return root
  for (const bundle of Object.values(payload.by_indicator ?? {})) {
    const legacy = normText(bundle.quantitative?.challenges)
    if (legacy) return legacy
  }
  return ''
}

/**
 * Compare a "before" revision snapshot with the "after/current" response and
 * return highlight keys for values that differ in the after view.
 */
export function buildResponseRevisionHighlight(
  beforeRaw: string | null | undefined,
  afterRaw: string | null | undefined,
): ResponseRevisionHighlight {
  const before = payloadFromRaw(beforeRaw)
  const after = payloadFromRaw(afterRaw)
  const hl = emptyHighlight()
  if (!after) return hl

  const beforeBy = before?.by_indicator ?? {}
  const afterBy = after.by_indicator ?? {}
  const indicatorIds = new Set([...Object.keys(beforeBy), ...Object.keys(afterBy)])

  for (const id of indicatorIds) {
    const b = beforeBy[id]
    const a = afterBy[id]
    if (!a && !b) continue

    const bq = b?.quantitative
    const aq = a?.quantitative

    if (normText(aq?.comment) !== normText(bq?.comment)) {
      hl.comments.add(id)
    }

    const aVal = aq?.value
    const bVal = bq?.value
    if (cellNum(aVal) !== cellNum(bVal)) {
      // Only flag legacy single-value when after has no matrix data for that indicator.
      const afterHasMatrix = MATRIX_DIMS.some((dim) => {
        const keyed = keyedBundle(aq, dim)
        return Boolean(keyed && Object.keys(keyed).length > 0)
      })
      if (!afterHasMatrix) hl.values.add(id)
    }

    for (const dim of MATRIX_DIMS) {
      const beforeMap = collectKeyedPaths(keyedBundle(bq, dim))
      const afterMap = collectKeyedPaths(keyedBundle(aq, dim))
      const keys = new Set([...beforeMap.keys(), ...afterMap.keys()])
      for (const path of keys) {
        const [yearId, columnId] = path.split('|')
        if (yearId == null || columnId == null) continue
        if ((beforeMap.get(path) ?? '') === (afterMap.get(path) ?? '')) continue
        hl.matrixCells.add(`${id}|${dim}|${yearId}|${columnId}`)
        // Year-totals bar is fed by gender / consolidated totals (or year-only col 0).
        if (
          columnId === 'total' ||
          columnId === '0' ||
          dim === 'gender' ||
          dim === 'consolidated'
        ) {
          hl.yearTotals.add(`${id}|${yearId}`)
        }
      }
    }

    const bQual = b?.qualitative
    const aQual = a?.qualitative
    const bYears = bQual?.by_year && Object.keys(bQual.by_year).length > 0 ? bQual.by_year : null
    const aYears = aQual?.by_year && Object.keys(aQual.by_year).length > 0 ? aQual.by_year : null
    if (bYears || aYears) {
      const yearKeys = new Set([
        ...Object.keys(bYears ?? {}),
        ...Object.keys(aYears ?? {}),
      ])
      for (const yearKey of yearKeys) {
        const bt = normText(bYears?.[yearKey]?.text)
        const at = normText(aYears?.[yearKey]?.text)
        if (bt !== at) hl.qualTexts.add(`${id}|${yearKey}`)
      }
    } else if (normText(aQual?.text) !== normText(bQual?.text)) {
      hl.qualTexts.add(`${id}|legacy`)
    }
  }

  if (challengesOf(after) !== challengesOf(before)) {
    hl.challenges = true
  }

  return hl
}

export function matrixCellHighlighted(
  hl: ResponseRevisionHighlight | null | undefined,
  indicatorId: number,
  dimension: MatrixDim | string,
  yearId: number,
  columnId: number | string,
): boolean {
  if (!hl) return false
  return hl.matrixCells.has(`${indicatorId}|${dimension}|${yearId}|${columnId}`)
}

export function yearTotalHighlighted(
  hl: ResponseRevisionHighlight | null | undefined,
  indicatorId: number,
  yearId: number,
): boolean {
  if (!hl) return false
  return hl.yearTotals.has(`${indicatorId}|${yearId}`)
}

/** True when any stored matrix cell for this indicator/dimension/year differs. */
export function dimensionYearHighlighted(
  hl: ResponseRevisionHighlight | null | undefined,
  indicatorId: number,
  dimension: MatrixDim | string,
  yearId: number,
): boolean {
  if (!hl) return false
  const prefix = `${indicatorId}|${dimension}|${yearId}|`
  for (const key of hl.matrixCells) {
    if (key.startsWith(prefix)) return true
  }
  return false
}

export function highlightHasAny(hl: ResponseRevisionHighlight | null | undefined): boolean {
  if (!hl) return false
  return (
    hl.matrixCells.size > 0 ||
    hl.yearTotals.size > 0 ||
    hl.comments.size > 0 ||
    hl.values.size > 0 ||
    hl.qualTexts.size > 0 ||
    hl.challenges
  )
}
