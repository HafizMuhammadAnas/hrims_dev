import { useCallback, useState } from 'react'

export type SortDirection = 'asc' | 'desc'

export type UseClientTableStateOptions<SortKey extends string> = {
  /**
   * Rows per page. Omit or set to `0` to disable slicing (all rows shown).
   */
  pageSize?: number
  initialPage?: number
  initialSearch?: string
  initialSortKey?: SortKey
  initialSortDir?: SortDirection
  initialFilters?: Record<string, string>
}

export type PaginatedSlice<T> = {
  pageRows: T[]
  totalPages: number
  totalItems: number
  effectivePage: number
}

/** Pure helper: slice `processed` for the current page, clamping page to valid range. */
export function derivePaginatedRows<T>(processed: T[], page: number, pageSize: number): PaginatedSlice<T> {
  const totalItems = processed.length
  if (!pageSize || pageSize <= 0) {
    return {
      pageRows: processed,
      totalPages: 1,
      totalItems,
      effectivePage: 1,
    }
  }
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const effectivePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = processed.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)
  return { pageRows, totalPages, totalItems, effectivePage }
}

/**
 * Shared client-side table UI state: search, string filters, sort, and page index.
 * Domain pages still own `useMemo` filter/sort of row arrays; this hook only holds controls + paging.
 */
export function useClientTableState<SortKey extends string>(
  options: UseClientTableStateOptions<SortKey> = {},
) {
  const {
    pageSize = 0,
    initialPage = 1,
    initialSearch = '',
    initialSortKey,
    initialSortDir = 'desc',
    initialFilters = {},
  } = options

  const [search, setSearchState] = useState(initialSearch)
  const [filters, setFiltersState] = useState<Record<string, string>>(initialFilters)
  const [sortKey, setSortKey] = useState<SortKey | undefined>(initialSortKey)
  const [sortDir, setSortDir] = useState<SortDirection>(initialSortDir)
  const [page, setPage] = useState(initialPage)

  const setSearch = useCallback((value: string) => {
    setSearchState(value)
    setPage(1)
  }, [])

  const setFilter = useCallback((key: string, value: string) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState({})
    setPage(1)
  }, [])

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('desc')
      return key
    })
  }, [])

  return {
    search,
    setSearch,
    filters,
    setFilter,
    setFilters: setFiltersState,
    resetFilters,
    sortKey,
    sortDir,
    setSortKey,
    setSortDir,
    toggleSort,
    page,
    setPage,
    pageSize,
  }
}
