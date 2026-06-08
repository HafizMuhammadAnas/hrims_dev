import type { SortDirection } from '../hooks/useClientTableState'

export function compareStringValues(a: string, b: string, dir: SortDirection): number {
  const cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  return dir === 'asc' ? cmp : -cmp
}

export function compareNumberValues(a: number, b: number, dir: SortDirection): number {
  return dir === 'asc' ? a - b : b - a
}

/** Newest / highest value first (dates, REQ ids, numeric ids). */
export function compareLatestFirst(a: string, b: string): number {
  return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })
}

export function sortRowsLatestFirst<T>(
  rows: readonly T[],
  pickSortKey: (row: T) => string | number | null | undefined,
): T[] {
  return [...rows].sort((left, right) => {
    const a = pickSortKey(left)
    const b = pickSortKey(right)
    if (typeof a === 'number' && typeof b === 'number') return b - a
    return compareLatestFirst(String(a ?? ''), String(b ?? ''))
  })
}
