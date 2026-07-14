import type { SortDirection } from '../hooks/useClientTableState'

export function compareStringValues(a: string, b: string, dir: SortDirection): number {
  const cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  return dir === 'asc' ? cmp : -cmp
}

export function compareNumberValues(a: number, b: number, dir: SortDirection): number {
  return dir === 'asc' ? a - b : b - a
}

/** Parse ISO dates, Y-m-d strings, or numeric values for chronological compare. */
export function toSortTime(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = String(value).trim()
  if (!raw) return 0
  const parsed = Date.parse(raw)
  if (Number.isFinite(parsed)) return parsed
  const asNum = Number(raw)
  return Number.isFinite(asNum) ? asNum : 0
}

/** Newest timestamp / highest value first. */
export function compareLatestFirst(a: string, b: string): number {
  const ta = toSortTime(a)
  const tb = toSortTime(b)
  if (ta !== 0 || tb !== 0) return tb - ta
  return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })
}

export function compareTimestampValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  dir: SortDirection,
): number {
  const cmp = toSortTime(a) - toSortTime(b)
  if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
  return compareStringValues(String(a ?? ''), String(b ?? ''), dir)
}

/**
 * First non-empty activity timestamp (updated → created → assigned → …).
 * Use when rows expose several date fields.
 */
export function pickActivityTimestamp(
  ...values: Array<string | number | null | undefined>
): string {
  for (const value of values) {
    if (value == null || value === '') continue
    return String(value)
  }
  return ''
}

export function sortRowsLatestFirst<T>(
  rows: readonly T[],
  pickSortKey: (row: T) => string | number | null | undefined,
): T[] {
  return [...rows].sort((left, right) => {
    const a = pickSortKey(left)
    const b = pickSortKey(right)
    const ta = toSortTime(a)
    const tb = toSortTime(b)
    if (ta !== 0 || tb !== 0) return tb - ta
    if (typeof a === 'number' && typeof b === 'number') return b - a
    return String(b ?? '').localeCompare(String(a ?? ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  })
}
